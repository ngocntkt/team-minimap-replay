from socket import socket
from mission import app, templates
from fastapi import Request, status
from fastapi import Form, WebSocket
from starlette.responses import RedirectResponse, Response

from sqlalchemy.orm import Session
from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from . import models, schemas, crud
from .db import ENGINE, SessionLocal

models.Base.metadata.create_all(bind=ENGINE)

import csv
from fastapi_socketio import SocketManager
from engineio.payload import Payload
Payload.max_decode_packets = 100

sio = SocketManager(app=app)
import random

import os
import ast

##IBL
import numpy as np
import pandas as pd
# from mission.IBL.environment import Environment
import argparse
import sys

import json

from speedyibl import Agent
import copy 
import time

from datetime import datetime, timedelta

from mission.ted import *

######################
# Database connection #
######################

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

############
# Globals #
############

# Read in global config
CONF_PATH = os.path.join(os.getcwd(), "mission/config.json")
with open(CONF_PATH, 'r') as f:
    CONFIG = json.load(f)

USER_MAP_SESSION = {}

DATA_DIR = os.path.join(os.getcwd(),'data')
is_exist = os.path.exists(DATA_DIR)
if not is_exist:
  os.makedirs(DATA_DIR)
  print(f"The new directory {DATA_DIR} is created!")


# Maximum number of playing episodes
MAX_EPISODE = CONFIG['max_episode']
# Maximum allowable game length (in seconds)
GAME_DURATION = CONFIG['game_duration']
# Run agent or not
run_agent = bool(CONFIG['run_agent'])
human_included = bool(CONFIG['human_included'])

number_roles = 2
number_human = CONFIG['number_human'] # number_human = [2,2]: 2 medics, 2 engineers
player_per_room = number_human[0]+number_human[1]
target = ['door', 'rubble', 'green', 'red', 'yellow']
DEMO_FOLDER = CONFIG['demo_folder']

def get_group_id():
    res = 0
    with ENGINE.connect() as con:
        query_str = "SELECT DISTINCT `game`.group FROM `game` ORDER BY CONVERT(`game`.group,INT) DESC LIMIT 1"
        rs = con.execute(query_str)
        for row in rs:
            print ('Current group id: ', row['group'])
            if row['group'] != None:
                res = int(row['group'])+1
            else:
                res = 0
    print('Group id: ', res)
    return res

connections = {}
players = {}
n_rooms = 1
# n_gen_room = 0
n_gen_room = get_group_id()
human_role = []
for i in range(number_human[0]):
    human_role.append(0)
for i in range(number_human[1]):
    human_role.append(1)

roomid = [i for i in range(n_gen_room*n_rooms,(1+n_gen_room)*n_rooms) for j in range(player_per_room)]

player_roomid = {} #list room_id corresponding to userid
roomid_env = {}
roomid_agents = {}
roomid_players = {} #list of rooms:{room1:{player1:{}, player2:{}}, room2:{player21:{'x', 'y'}, player22:{'x','y'}}}
scoreboard_players = {} #similar to roomid_players

config_players = {} #list of configuration group: {room1:configuration, room2:configuration}
timer_recording = {} # list of timer recording each group's da

room_data = {} #room_id and values is the list of players' events
LOGIN_NAMES_TEMP = []


map_data = {}
map_lookup = {}
replay = False

def codebook (code_num):
    if code_num==1:
        return "wall"
    elif code_num==2:
        return "door"
    elif code_num==3:
        return "green"
    elif code_num==4:
        return "blue"   #blue victims (teammate save only)
    elif code_num==5:
        return "red"    #red victims (participants save only)
    elif code_num==6:
        return "yellow"
    elif code_num==7:
        return "other"
    elif code_num==8:
        return "agent"
    elif code_num==9:
        return "rubble"
    elif code_num==11:
        # return "left_pane"
        # return "center_pane"
        return ""
    elif code_num==12:
        # return "center_pane"
        return ""
    elif code_num==13:
        # return "right_pane"
        # return "center_pane"
        return ""
    

def process_map():
    # df_map = pd.read_csv('mission/static/data/map_new_design.csv')
    df_map = pd.read_csv('mission/static/data/map_design_2.csv')
    new_map = pd.melt(df_map, id_vars='x/z', value_vars=[str(i) for i in range(0,95)], var_name='z', value_name='key')
    new_map = new_map.rename(columns={"x/z": "x"})
    new_map.index.name='id'
    new_map['key2'] = new_map.apply(lambda x: codebook(x['key']), axis=1)
    new_map.columns = ['z', 'x', 'code', 'key']
    new_map.to_csv('mission/static/data/map_new.csv')
    

def get_map():
    csvFilePath = 'mission/static/data/map_new.csv'
    data = {} 
    global map_data
    with open(csvFilePath, encoding='utf-8') as csvf: 
        csvReader = csv.DictReader(csvf) 
        for rows in csvReader: 
            key = rows['id'] 
            data[key] = rows
            
    map_data = data
    return data
# get_map()

sys.argv=['']
del sys
flags = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter, description="IBL")
flags.add_argument('--type',type=str,default='td',help='Environment.')
flags.add_argument('--episodes',type=int,default=1000,help='Number of episodes.') #ok results with 1000
flags.add_argument('--steps',type=int,default=100,help='Number of steps.') #ok results with 100
FLAGS = flags.parse_args()
map_data = get_map()


agents = []
agent_steps = {} 


# agent = AgentIBL(env.out,default_utility=0.1, Hash=True)
# observations = env.reset()
observations = {}
NoCols = {} # [True,True]
agent_type = 'default' # 'handed'
# agent_type = 'handed' # 'handed'

# role_number=1 #0:medic; 1:engineer
role_name = {0:'medic', 1:'engineer'}
human_previous_loc = {}


def get_role(player_id,idroom):
    # connections.index(msg['pid'])
    tmp = get_role_num(player_id,idroom)
    return role_name[tmp]

def get_role_num(player_id,idroom):
    global human_role
    print("ID room: ", idroom)
    print('Connection room : ', connections[idroom])
    print('Human role', human_role)
    print('Get role num: ', human_role[connections[idroom].index(player_id)])
    return human_role[connections[idroom].index(player_id)]
    

def getAction(x1,y1,x2,y2):
    dx = x2 - x1
    dy = y2 - y1
    if dx==0 and dy==-1:
    #// action = 0; //up
        return 0
    elif dx==1 and dy==0:
    #// action = 1; //right
        return 1
    elif dx==0 and dy==1:
    #// action = 2; //down
        return 2
    elif dx==-1 and dy==0:
    #// action = 3; //left
        return 3
    elif dx==0 and dy==0:
    #// action = 4; //stay
        return 4
    else:
        print('error dx, dy', dx, dy, x1,y1,x2,y2)
    
def get_event(gid, bot_x, bot_y):
    global map_lookup
    res = map_lookup[gid].get((bot_x, bot_y), '')
    if res in target:
        map_lookup[gid][(bot_x, bot_y)] = ''
    return res



######################
# Utility Visualization:
######################

vis_players = {}
data_dict = {}
gid = {}
vis_data_file = {}
vis_data = {}
vis_score = {}

@app.sio.on('join')
async def on_join(sid, *args):
    global gid
    msg = args[0]
    pid = msg['pid']
    print('Join, group: ', gid[pid])
    app.sio.enter_room(sid, gid[pid])

def read_file(uid, fname):
    global vis_players
    global gid
    global data_dict
    vis_score[uid] = {}
    config_vis = {} 

    if not fname.endswith('json'):
        return 0
    f = open(os.path.join(os.getcwd(), 'data', DEMO_FOLDER, fname))
    vis_data[uid] = json.load(f)
    gid[uid] = fname.split('_')[2]
    config_vis[gid[uid]] = configuration()
    initialize_state(config_vis[gid[uid]])
    mission_start(config_vis[gid[uid]])
    # episode = fname.split('_')[4]
    vis_players[gid[uid]] = {}
    data_dict[uid] = {}
    count = 0
    
    # num players in the vis file:
    num_vis_players = len(list(json.loads(vis_data[uid][-1]).keys()))

    for line in vis_data[uid]:
        # message = ast.literal_eval(line)
        # message = eval(line)
        message = json.loads(line)
        # message = line
        # print('Message: ', type(message))
        if len(list(message.keys())) != num_vis_players:
            continue
        for player in message.keys():
            vis_players[gid[uid]][player] = {}
        data_dict[uid][count] = message
        # print("Data dict:", data_dict)
        vis_score[uid][count] = message[player]['score']
        count += 1
    return vis_data[uid]

@app.sio.on('start_vis')
async def sio_start_visualization(sid, *args, **kwargs):
    global vis_data
    global vis_players
    global gid
    global replay
    msg = args[0]
    replay = msg['replay']
    pid = msg['pid']

    # vis_data = read_file(CONFIG['vis_file'])
    config_players[gid[pid]] = configuration()
    initialize_state(config_players[gid[pid]])
    mission_start(config_players[gid[pid]])
     # num players in the vis file:
    num_vis_players = len(list(json.loads(vis_data[pid][-1]).keys()))

    for line in vis_data[pid]:
        message = ast.literal_eval(line)
        if len(list(message.keys())) != num_vis_players:
            continue
        for player in message.keys():
            vis_players[gid[pid]][player]['x'] = message[player]['x']
            vis_players[gid[pid]][player]['y']=message[player]['y']
            vis_players[gid[pid]][player]['role']=message[player]['role']
            # vis_players[gid][player]['timestamp']=message[player]['timestamp']
        break
    main(data_dict[pid][0], config_players[gid[pid]])
    await app.sio.emit('vis_response', {"list_players":vis_players, "first_player": list(vis_players[gid[pid]].keys())[0],"roomid":gid[pid]}, room=gid[pid])

    print('Call start_vis')

@app.get("/vis-episode/{selectedFile}")
async def get_episode(request:Request, selectedFile: str):
    global vis_data_file
    # episode = CONFIG['vis_file'].split('_')[4].split('.')[0]
    print("Selected file: ", selectedFile)
    episode = selectedFile.split('_')[4].split('.')[0]
    group_id = selectedFile.split('_')[2]
    print('Vis episode: ', episode)
    return {'gid': group_id, 'episode':episode} 

@app.sio.on('ted_vis')
async def on_call_ted_vis(sid, *args, **kwargs):
    global gid
    global player_roomid
    global config_players
    msg = args[0]
    uid = msg['uid']
    
    # print(f'Call message data ted-vis', config_players[gid].state['msg_data'])
    await app.sio.emit('ted vis response', {"ted_players":config_players[gid[uid]].state['msg_data']}, room=gid[uid])


def step_counter(reset = False):
    if "counter" not in step_counter.__dict__:
        step_counter.counter = 0
    
    if reset:
        step_counter.counter = 0
    else:
        step_counter.counter += 1

    return step_counter.counter

step_counter(reset = True)

@app.get("/agent_pos/{uid}")
async def get_agent_positions(uid:str):
    global vis_data
    global vis_players
    global gid 
    global data_dict
    global replay
    if replay:
        print('Call replay: ', replay)
        step_counter(reset = True)
        replay = False
    curr_step = step_counter()
    res = {}
    if uid in data_dict.keys():
        if  curr_step in data_dict[uid].keys():
            # print("Data dict cur: ", data_dict[uid][curr_step])
            # print('Group id: ', gid[uid])
            if gid[uid] in config_players.keys():
                main(data_dict[uid][curr_step], config_players[gid[uid]])
                res =  {"list_players":data_dict[uid][curr_step], "score":vis_score[uid][curr_step], "roomid":gid[uid]}
        else:
            res = False
            print('Out of data')
        # print('Res: ', res)
        return res

######################
# Application routes #
######################
@app.get("/")
async def index(request:Request):
    return {"message": "Welcome"}
    

@app.get("/vis/")
async def get_full_map(request:Request, uid: str = 'TEST123', session:int = 1):
    # directory = os.path.abspath(os.path.join(os.getcwd(), os.pardir)) 
    directory = os.getcwd()
    directory = directory+f'/data/{DEMO_FOLDER}'
    items = []
    # list_file = os.listdir(directory)
    list_file = [f for f in os.listdir(directory) if f.endswith('.json')]
    # sorted(list_file)
    # print(list_file)
    list_file.sort(key=lambda x: (int(x.split('_')[2]), int(x.split('_')[4].split('.')[0])))
    # for myfile in sorted(os.listdir(directory)):
    for myfile in list_file:
        if myfile!='.DS_Store':
            items.append(myfile)
    return templates.TemplateResponse("startvis.html", {"request":request, "items":items, "data":uid, "session":session})


@app.post("/visualization/")
async def post_full_map(request:Request, uid: str = Form(...), session:int = Form(...), fname: str = Form(...)):
    global vis_data
    global vis_data_file
    print("User id: ", uid)
    vis_data_file[uid] = fname
    vis_data[uid] = read_file(uid, fname)
    print("Call visualization: ", fname)
    return templates.TemplateResponse("visualization.html", {"request":request, "data":uid, "selectedFile":fname})


@app.get("/episode/{uid}")
async def get_episode(request:Request, uid:str, db: Session = Depends(get_db)):
    episode = crud.get_episode_by_uid(db, uid)
    print("Episode from server: ", episode)
    return episode


@app.get("/points/{uid}")
async def get_total_pints(request:Request, uid:str, db: Session = Depends(get_db)):
    points = 0
    with ENGINE.connect() as con:
        query_str = "SELECT episode, target, COUNT(DISTINCT target_pos) as num FROM `game` WHERE `game`.group = (select distinct `game`.group from `game` where userid= '" + uid + "') and (target LIKE 'green%' or target LIKE 'yellow%' or target LIKE 'red%') GROUP BY episode, target"
        rs = con.execute(query_str)
        for row in rs:
            # print(row)
            if row['target']=='green_victim':
                points += row['num']*10
            elif row['target']=='yellow_victim':
                points += row['num']*30
            elif row['target']=='red_victim':
                points += row['num']*60
            # print('Getting points:', row['target'])
            # print('Getting points:', row['num'])
    # print(f"Total (group) points of {uid}: {points}")
    return points

@app.get("/map")
async def get_map_data():
    # return {"map_data":map_data}
    x_pos = set()
    y_pos = set()
    
    for k in list(map_data.keys()):
        x_pos.add(map_data[k]['x'])
        y_pos.add(map_data[k]['z'])
    x_pos = [int(i) for i in x_pos]
    y_pos = [int(i) for i in y_pos]
    max_x = max(x_pos)
    max_y = max(y_pos)
    return {"map_data":map_data, 'max_x':max_x, 'max_y':max_y, 'max_episode':MAX_EPISODE}

@app.post("/game_play", response_model=schemas.Game)
async def create_game(game: schemas.GameCreate, db: Session = Depends(get_db)):
    return crud.create_game(db=db, game=game)
