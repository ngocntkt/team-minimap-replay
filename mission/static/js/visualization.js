var namespace = 'http://' + document.domain + ':' + location.port;
// var socket = io(namespace, {path: '/ws/socket.io'}); //working....
var socket = io(namespace, { path: '/ws/socket.io' });

var grid, gridCopy;
var cols;
var rows;
var width, height;
var w = 12;
var agentX;
var agentY;
var agentDirX;
var agentDirY;
var curX, curY;

const uid = document.getElementById("uid").value;
const selectedFile = document.getElementById("selectedFile").value;
var groupID;


var numSteps = 0;
var traces = [];
var cost = 0;
var score = 0;
var block = 0;
var targetSteps = 0;

var isGameOver = false;


var countPress = 0;
var rescue = 0;
const timeDisplay = document.querySelector('#playtime');
var totalMinutes = 5 * 60;
var display = document.querySelector('#time');

// var episode=0;
var episode = document.getElementById("session").value;
var maxEpisode;
const episodeDisplay = document.getElementById('episode');

const dist = 2;
var listFoV = [];
var listYellow = [];
var minuteYellowDie = 0;
var secondYellowDie = 0;

var listRed = [];
var minuteRedDie = 3;
var secondRedDie = 0;

var iframe = document.getElementById('frame-qualtrics');
var closeBtn = document.getElementById('close-button');
var chkMap = document.querySelector('#map');
var chkFull = document.querySelector('#full_falcon');

var numRescuedGreen = 0;
var numRescuedYellow = 0;
var numRescuedRed = 0;
var otherX = [];
var otherY = [];
var roles = [];
var players = [];
var playerId;
var groupSize;
var roleName = '';
// const groupSize = document.getElementById('size').value;
var roomid;
var medicImg;
var engineerImg;
var isFirst = true;
var intervalRecordData;
var intervalEmitSocket;

let effortHis = [], skillHis = [], efficiency = [];
var agentPreX = [], agentPreY = [];

// waiting room
var lobbyWaitTime = 10 * 60 * 1000; //wait 10 minutes
window.intervalID = -1;
window.ellipses = -1
window.lobbyTimeout = -1;

window.onload = function () {
  showFullView(chkFull);
};

function showElement(ElementId) {
  document.getElementById(ElementId).style.display = 'block';
}

function hideElement(ElementId) {
  document.getElementById(ElementId).style.display = 'none';
}

function showMap(chkMap) {
  if (chkMap.checked) {
    ISMAP = true;
  } else {
    DEBUG = false;
    ISMAP = false;
  }
}

function showFullView(chkFull) {
  if (chkFull.checked) {
    DEBUG = true;
  } else {
    DEBUG = false;
  }
}

var isReplay = true;
function myReplay(z) {
  var x = document.getElementById("replayStatus");
  z.classList.toggle("fa-play-circle");
  if (x.innerHTML === "Playing") {
    isReplay = false;
    x.innerHTML = "Pausing";
  } else {
    x.innerHTML = "Playing";
    isReplay = true;
  }
}




function setup() {
  // showFullView(chkFull);
  console.log("Client socket: ", socket.id);
  // playerId = socket.id.split("#")[1];
  // playerId = socket.id;
  playerId = uid;
  console.log('Client socket id:', playerId);
  
  socket.emit('join', { "pid": playerId, "uid": uid });

  var canvas = createCanvas(0, 0);
  initializeTEDGraph();
  frameRate(20);

  // load images
  // medicImg = loadImage("https://cdn-icons.flaticon.com/png/512/2371/premium/2371329.png?token=exp=1646427991~hmac=66091d24f0f77d7e5a90a48fd33dc6d9");
  medicImg = loadImage("https://raw.githubusercontent.com/ngocntkt/visualization-map/master/aid.png");
  engineerImg = loadImage("https://raw.githubusercontent.com/ngocntkt/visualization-map/master/hammer2.png");

  // showFullView(chkFull);
  // showMap(chkMap);
  showElement("game-container");
  async function getEpisode() {
    // const response = await fetch('/vis-episode/'+uid.toString());
    const response = await fetch('/vis-episode/'+selectedFile.toString());
    const data = await response.json();
    episode = Number(data['episode']);
    groupID = Number(data['gid']);
    episodeDisplay.textContent = 'GroupID: '+groupID+' | Episode: ' + episode;
  }
  getEpisode();
  // episodeDisplay.textContent = 'Episode: ' + episode;
  $('#tab-panel').show();
  $('#tabgame').show();
  $('#lobby').hide();

  socket.emit('start_vis', {'pid': uid, 'replay': true });
  getMap();

  async function getMap() {
    const response = await fetch('/map');
    const data = await response.json();

    width = (parseInt(data["max_x"]) + 1) * w + 1;
    height = (parseInt(data["max_y"]) + 1) * w + 1;
    var canvas = createCanvas(width, height); //
    canvas.parent('sketch-holder');
    cols = floor(width / w);
    rows = floor(height / w);
    grid = make2DArray(cols, rows);
    gridCopy = make2DArray(cols, rows);
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        grid[i][j] = new Cell(i, j, w);
      }
    }
    generateGrid(data["map_data"]);

    maxEpisode = parseInt(data["max_episode"]);
  }

  socket.on('vis_response', function (msg) {
    playerId = msg['first_player']
    console.log(msg['first_player'])
    roomid = msg['roomid']
    console.log('room id', roomid)
    groupSize = Object.keys(msg['list_players'][roomid]).length;
    console.log("Group size: ", groupSize);
    // console.log(Object.keys(msg['list_players']));
    players = Object.keys(msg['list_players'][roomid]);
    console.log(Object.values(msg['list_players']));
    for (const [key, value] of Object.entries(msg['list_players'][roomid])) {
      objVal = value;
      otherX.push(Object.values(objVal)[0]);
      otherY.push(Object.values(objVal)[1]);
      // otherX.push(agentX);
      // otherY.push(agentY);

      roles.push(Object.values(objVal)[2]);
      if (key == playerId) {
        roleName = Object.values(objVal)[2];
        // console.log("What is your role: ", roleName);

        // socket.emit('update', { "pid": playerId, "x": Object.values(objVal)[0], "y": Object.values(objVal)[1], 'mission_time': display.textContent, 'event': '' })

        groupID = parseInt(roomid);
      }
    }
    getListPlayers();

  });

  intervalRecordData = setInterval(function () {
    // No need to write data at all.
  }, 30 * 1000);

  intervalEmitSocket = setInterval(function () {
    // No need to emit socket as well.
  }, 1000);

  if (!isGameOver) {
    // setInterval(getListPlayers, 1000);
    setInterval(getListPlayers, 1000); //the speed of the bot 100(OK); 300(quite slow)
    // setInterval(getTED, 10000); //call TED every 10s
    setInterval(getTED, 3000); //call TED every 10s
  }
}//end-setup

function initializeTEDGraph(){
  $(function () {
    tedChart = {gaugeChartEffort : null,gaugeChartSkill : null, gaugeChartEfficiency: null};
    tedChart.gaugeChartEffort = $('#gaugeChartEffort').epoch({
        type: 'time.gauge',
        value: 0
      });
    tedChart.gaugeChartSkill = $('#gaugeChartSkill').epoch({
        type: 'time.gauge',
        value: 0
      });
    tedChart.gaugeChartEfficiency = $('#gaugeChartEfficiency').epoch({
        type: 'time.gauge',
        value: 0
      });

    /*
      tedChart.lineChart = $('#areaChart').epoch({
        type: 'time.line',
        data: [
            {label: "Effort", values: getHistoricData()},
            {label: "Skill", values: getHistoricData()},
            {label: "Efficiency", values: getHistoricData()},
        ],
        axes: ['left', 'right', 'bottom']
      });

     */
    // tedChart.historyEff = [50,60,70,90,90,50,30,20,20,40,60,70];
    // $("#liveChartEffort").sparkline([50,60,70,90,90,50,30,20,20,40,60,70], {
    // type: 'line'});

    tedChart.historyEff = new Array(12).fill(0);
    $("#liveChartEffort").sparkline(new Array(12).fill(0), {
    type: 'line'});

    tedChart.historySkill = new Array(12).fill(0);
    $("#liveChartSkill").sparkline(new Array(12).fill(0), {
      type: 'line'});

    tedChart.historyEfficiency = new Array(12).fill(0);
    $("#liveChartEfficiency").sparkline(new Array(12).fill(0), {
      type: 'line'});

    });

}

function getHistoricData(){

  var entries = 60;
  var history = [];
  for (var k = 0; k < 3; k++) {
      var config = { values: [] };
      history.push(config);
  }
  var timestamp = ((new Date()).getTime() / 1000);
  for (var i = 0; i < entries; i++) {
      for (var j = 0; j < 3; j++) {
          history[j].values.push({time: timestamp, y:  parseInt(Math.random() * 100  ) + 50});
      }
      timestamp++;
  }
  return history;
}

getTED.calledTimes = 0;
function getTED() {
  if (isReplay) {
    socket.emit('ted_vis', { "uid": uid, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': '' })
    socket.on('ted vis response', function (msg) {

      pos_element = getTED.calledTimes;
      console.log("TED has been called: ", pos_element);

      if (msg['ted_players'][pos_element] != undefined &&
        msg['ted_players'][pos_element] != null &&
        Object.keys(msg['ted_players'][pos_element]).length > 0) {
        // console.log("Effort: ", msg['ted_players'][pos_element]['process_effort_s']);
        effortHis.push(msg['ted_players'][pos_element]['Effort'])
        
        // document.getElementById('effort').innerHTML = 'Effort: ' + parseFloat(msg['ted_players'][pos_element]['Effort']).toFixed(2);
        // document.getElementById('skill').innerHTML = 'Skill: ' + parseFloat(msg['ted_players'][pos_element]['Skill']).toFixed(2);
        // document.getElementById('efficiency').innerHTML = 'Strategy: ' + parseFloat(msg['ted_players'][pos_element]['Workload']).toFixed(2);

        tedChart.gaugeChartEffort.push(parseFloat(msg['ted_players'][pos_element]['Effort']));
        tedChart.gaugeChartSkill.push( parseFloat(msg['ted_players'][pos_element]['Skill']));
        tedChart.gaugeChartEfficiency.push(parseFloat(msg['ted_players'][pos_element]['Workload']));

        console.log("Lengh history effort: "  + effortHis.length);
        console.log("new value:" +msg['ted_players'][pos_element]['Effort'] * 100);
        tedChart.historyEff.push(msg['ted_players'][pos_element]['Effort'] * 100)
        $("#liveChartEffort").sparkline(tedChart.historyEff, { type: 'line'});

        tedChart.historySkill.push(msg['ted_players'][pos_element]['Skill'] * 100)
        $("#liveChartSkill").sparkline(tedChart.historySkill, { type: 'line'});

        tedChart.historyEfficiency.push(msg['ted_players'][pos_element]['Workload'] * 100)
        $("#liveChartEfficiency").sparkline(tedChart.historyEfficiency, { type: 'line'});


      } else {
        console.log(msg['ted_players'][pos_element].length)
        console.log("Hmm: ", msg['ted_players'][pos_element]);
        effortHis.push(0);
      }
      getTED.calledTimes++;
    });

  }

}

function getListPlayers() {
  if (!isGameOver) {
  }

  socket.on('heartbeat', function (msg) {
    // console.log("Heartbeat msg from server: ", msg);
    for (var k = 0; k < players.length; k++) {
      if (players[k] !== undefined) {
        var pid = players[k];
        otherX[k] = parseInt(msg[pid]['x']);
        otherY[k] = parseInt(msg[pid]['y']);
        roles[k] = msg[pid]['role'].toString();
        updateEnvironment(otherX[k], otherY[k]);
        // updateScoreBoard(msg['score']['green'], msg['score']['yellow'], msg['score']['red']);
      }
    }
  });

  socket.on('vis_change', function (msg) {
    // roomid = msg['roomid']
    // groupSize = Object.keys(msg['list_players'][roomid]).length;
    // console.log("Group size: ", groupSize);
    // console.log(Object.keys(msg['list_players']));
    players = Object.keys(msg['list_players']);
    for (var k = 0; k < players.length; k++) {
      if (players[k] !== undefined) {
        var pid = players[k];
        otherX[k] = parseInt(msg['list_players'][pid]['x']);
        otherY[k] = parseInt(msg['list_players'][pid]['y']);
        // roles[k] = msg['list_players'][roomid][pid]['role'].toString();
        updateEnvironment(otherX[k], otherY[k]);
        updateScoreBoard(msg['score']['green'], msg['score']['yellow'], msg['score']['red']);
      }
    }
  });

  socket.on('leave', function (msg) {
    var idx = players.indexOf(msg['pid'])
    //here using "delete players[idx]"" instead of "players.splice(idx,1)"" 
    // because we don't want to drop the index of the disconnected player; if using splice both player and its index are removed
    if (idx != -1) {
      delete players[idx];
    }
  });
}//end getListPlayer

function updateScoreBoard(green, yellow, red) {
  rescue = green * 10 + yellow * 30 + red * 60;
  numRescuedGreen = green;
  numRescuedYellow = yellow;
  numRescuedRed = red;
  document.getElementById('goal').innerHTML = 'Points: ' + rescue.toString();
  document.getElementById('green').innerHTML = 'Green: ' + numRescuedGreen.toString();
  document.getElementById('yellow').innerHTML = 'Yellow: ' + numRescuedYellow.toString();
  document.getElementById('red').innerHTML = 'Red: ' + numRescuedRed.toString();
}

function updateEnvironment(loc_x, loc_y) {
  
  if (grid[loc_x][loc_y].goal == 'yellow') {
    grid[loc_x][loc_y].goal = "";
  }
  else if (grid[loc_x][loc_y].goal == 'green') {
    grid[loc_x][loc_y].goal = "";
  }

  // //TODO?: check if an engineer or medic surrounding. (Or don't need to check, since if it walks into the red location, it must satisfy the condition.)
  else if (grid[loc_x][loc_y].goal == 'red') {
    grid[loc_x][loc_y].goal = "";
  }
  
  else if (grid[loc_x][loc_y].goal == 'door') {
    console.log('Hit door...');
    grid[loc_x][loc_y].goal = '';

    // socket.emit('periodic call', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'door' })
  }
  else if (grid[loc_x][loc_y].goal == 'rubble') {
    grid[loc_x][loc_y].goal = ''
    // socket.emit('periodic call', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'rubble' })
  }
}

function updateMissionTime(missionTime) {
  var minutes = missionTime.split(':')[0]
  var seconds = missionTime.split(':')[1]
  document.getElementById("time").innerHTML = minutes + ":" + seconds;
  // if ((minutes == '02' && seconds == '00:') || (minutes < '02')) {
  //   for (var i in listYellow) {
  //     var posX = listYellow[i][0];
  //     var posY = listYellow[i][1];
  //     grid[posX][posY].goal = "";
  //   }
  // }
  if (minutes == '02' && seconds == '00:' || (minutes < '02')) {
    for (var i in listRed) {
      var posX = listRed[i][0];
      var posY = listRed[i][1];
      grid[posX][posY].goal = "";
    }
  }
}

function generateGrid(data) {
  size = Object.keys(data).length;
  for (let entry of Object.entries(data)) {
    var type = entry[1]['key'];
    var posX = Number(entry[1]['x']);
    var posY = Number(entry[1]['z']);
    grid[posX][posY].goal = type;
    grid[posX][posY].prev = type;

    if (type == "yellow") {
      listYellow.push([posX, posY]);
    }
    if (type == "red") {
      listRed.push([posX, posY]);
    }
    else if (type == "agent") {
      agentX = posX;
      agentY = posY;
      agentDirX = 0;
      agentDirY = 0;
      // console.log("Agent X; Agent Y: ", agentX, agentY);
    }

  }

  traces.push("(" + agentX + "," + agentY + ")");
  // socket.emit('start-vis', {})
}

function gameOver() {
  isGameOver = true;
  clearInterval(timeout);
  clearInterval(intervalRecordData);
  clearInterval(intervalEmitSocket);

  console.log("Game over");
  timeDisplay.textContent = "GAME OVER !";

  // var data = {
  //   "userid": uid, "group": groupID, "role": roleName, "episode": episode, "target": "", "target_pos": "",
  //   "num_step": targetSteps, "time_spent": "stop", "trajectory": traces.join(";")
  // };
  // writeData(data);

  // socket.emit('end', { "pid": playerId, 'uid': uid, 'gid': groupID, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'end mission', 'episode': episode })
  async function getTotalPoint() {
    const response = await fetch('/points/' + uid + '/');
    const data = await response.json();
    console.log(data)
    $('#tab-panel').hide();
    $('#tabgame').hide();
    $('#notification').show();

    var h2 = $('h2', '.notification');
    $("div#notification h2").text(
      "Total points of your team is: " + data
    );
    $("#notification-content").text(
      "You have finished playing the game. You will be forwarded to the post-study section in a few seconds."
    );
  }

  if (episode == maxEpisode) {
    // showElement("finish-button");
    var button = document.getElementById('finish-button');

    // getTotalPoint();

    sleep(3000).then(() => {
      getTotalPoint();
    });
    sleep(5000).then(() => { button.click(); });

  } else {
    var button = document.getElementById('next-button');
    // sleep(2000).then(() => {
    //   $('#tab-panel').hide();
    //   $('#tabgame').hide();
    //   $('#notification').show();
    // });
    // sleep(5000).then(() => { button.click(); });
  }
}

function writeData(data) {
  const dataOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
  fetch('/game_play', dataOptions);
}

async function getAgentData() {
  const response = await fetch('/agent_pos/'+uid.toString());
  const msg = await response.json();
  // console.log('Data: ', msg['list_players']['A1EQ1LHEEIQ3UA'])
  if (agentPreX.length > 0) {
    for (var i = 0; i < agentPreX.length; i++) {
      // grid[agentPreX[i]][agentPreY[i]].markAsVisitedbyAgent();
      grid[agentPreX[i]][agentPreY[i]].markAsVisitedbyRole(grid[agentPreX[i]][agentPreY[i]].goal);
    }
  }
  if (msg != false) {
    // populate the new agent locations
    // console.log('Player list: ', players.length)
    for (var k = 0; k < players.length; k++) {
      if (players[k] !== undefined) {
        var pid = players[k];
        // console.log('Pid: ', pid)
        var posX = parseInt(msg['list_players'][pid]['x']);
        var posY = parseInt(msg['list_players'][pid]['y']);
        agentPreX.push(posX);
        agentPreY.push(posY);
        var missionTime = msg['list_players'][pid]['mission_time'];
        if (players[k] == playerId) {
          grid[posX][posY].agent = true;
          grid[posX][posY].addAgentImage(roles[k]);
          grid[posX][posY].goal = roles[k];
          agentX = posX;
          agentY = posY;
        } else {
          grid[posX][posY].other_agent = true;
          grid[posX][posY].addOtherAgentImg(roles[k]);
          grid[posX][posY].goal = roles[k];
        }
        updateEnvironment(posX, posY);
        updateScoreBoard(msg['list_players'][pid]['score']['green'], msg['list_players'][pid]['score']['yellow'], msg['list_players'][pid]['score']['red']);
        updateMissionTime(missionTime);
      }
    }
  }
}

function draw() {
  // background(200,200,200,127);
  background(173, 216, 230, 127);

  if (isReplay) {
    getAgentData(); 
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        grid[i][j].show();
        gridCopy[i][j] = grid[i][j];
      }
    }
  }
  else {
    showGridCopy();

  }

}

function showGridCopy() {
  if (agentPreX.length > 0) {
    for (var i = 0; i < agentPreX.length; i++) {
      gridCopy[agentPreX[i]][agentPreY[i]].markAsVisitedbyRole(grid[agentPreX[i]][agentPreY[i]].goal);
    }
    for (var j=1; j<=players.length; j++)
    gridCopy[agentPreX[agentPreX.length - j]][agentPreY[agentPreY.length - j]].addAgentImage(gridCopy[agentPreX[agentPreX.length - j]][agentPreY[agentPreY.length - j]].goal);
  }
  for (var i = 0; i < cols; i++) {
    for (var j = 0; j < rows; j++) {
      gridCopy[i][j].show();
    }
  }
}

function showFoV(paraX, paraY, mDist) {
  if (agentX > 0 && agentX < width && agentY > 0 && agentY < height) {
    var blockList = ['wall', 'door', 'rubble']
    var op1 = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // right, left, down, up
    var op2 = [[1, 0], [0, -1], [-1, 0], [0, 1], [1, 0]];
    var op = [[[0, 1], [0, 1], [1, 0], [1, 0]], [[0, 0], [0, 0], [0, 0], [0, 0]], [[0, -1], [0, -1], [-1, 0], [-1, 0]]];
    for (var i = 0; i < op1.length; i++) {
      for (var t = 0; t < mDist; t++) {
        if (agentX == 1 || agentX == 91 || agentY == 1 || agentY == 48) {
          if (t > 0) {
            break;
          }
        }
        if (blockList.includes(grid[agentX + op2[i][0] * (t + 1) + op2[i + 1][0] * t][agentY + op2[i][1] * (t + 1) + op2[i + 1][1] * t].goal) &&
          blockList.includes(grid[agentX + op2[i + 1][0] * (t + 1) + op2[i][0] * t][agentY + op2[i + 1][1] * (t + 1) + op2[i][1] * t].goal)) {
          for (var k = 1; k < mDist - t + 1; k++) {
            for (var h = 1; h < mDist - t + 1; h++) {
              let idx = listFoV.indexOf("(" + (agentX + op2[i][0] * (t + k) + op2[i + 1][0] * (t + h)) + "," + (agentY + op2[i][1] * (t + k) + op2[i + 1][1] * (t + h)) + ")")
              if (idx > -1) {
                listFoV.splice(idx, 1);
              }
            }
          }
        }
      }

      for (var j = 0; j < op.length; j++) {
        var tmpX = op1[i][0] + op[j][i][0];
        var tmpY = op1[i][1] + op[j][i][1];
        if (blockList.includes(grid[agentX + tmpX][agentY + tmpY].goal)) {
          let idx = listFoV.indexOf("(" + (agentX + tmpX * 2) + "," + (agentY + tmpY * 2) + ")")
          if (idx > -1) {
            listFoV.splice(idx, 1);
          }

          var tmpX3 = op1[i][0] * 2 + op[j][i][0];
          var tmpY3 = op1[i][1] * 2 + op[j][i][1];
          idx = listFoV.indexOf("(" + (agentX + tmpX3) + "," + (agentY + tmpY3) + ")")
          if (idx > -1) {
            listFoV.splice(idx, 1);
          }
        }
      }
    }

    if (listFoV.indexOf("(" + paraX + "," + paraY + ")") > -1) {
      grid[paraX][paraY].revealed = true;
      grid[paraX][paraY].drawFoV();
    } else {
      grid[paraX][paraY].revealed = false;
    }
  }
}

function isFoV(paraX, paraY, mDist) {
  var mLeft = agentX - mDist;
  var mRight = agentX + mDist;
  var mUp = agentY - mDist;
  var mDown = agentY + mDist;
  if (agentY == 0) {
    mUp = 0;
  }
  else if (agentY == height) {
    mDown = height;
  }
  if (agentX == 0) {
    mLeft = 0;
  }
  else if (agentX == width) {
    mRight = width;
  }
  return (paraX >= mLeft && paraX <= mRight && paraY >= mUp && paraY <= mDown);
}

function make2DArray(cols, rows) {
  var arr = new Array(cols);
  for (var i = 0; i < arr.length; i++) {
    arr[i] = new Array(rows);
  }
  return arr;
}


var timeout;
function startTimer(duration, display) {
  var start = Date.now(),
    diff,
    minutes,
    seconds;

  function timer() {
    diff = duration - (((Date.now() - start) / 1000) | 0);

    if (diff >= 0) {
      minutes = (diff / 60) | 0;
      seconds = (diff % 60) | 0;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;
      display.textContent = minutes + ":" + seconds;
      document.getElementById("time").innerHTML = minutes + ":" + seconds;
    }
  };
  timer();
  timeout = setInterval(timer, 1000);
}

function showFoV(paraX, paraY, mDist) {
  if (agentX > 0 && agentX < width && agentY > 0 && agentY < height) {
    var blockList = ['wall', 'door', 'rubble']
    var op1 = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // right, left, down, up
    var op2 = [[1, 0], [0, -1], [-1, 0], [0, 1], [1, 0]];
    var op = [[[0, 1], [0, 1], [1, 0], [1, 0]], [[0, 0], [0, 0], [0, 0], [0, 0]], [[0, -1], [0, -1], [-1, 0], [-1, 0]]];
    for (var i = 0; i < op1.length; i++) {
      for (var t = 0; t < mDist; t++) {
        if (agentX == 1 || agentX == 91 || agentY == 1 || agentY == 48) {
          if (t > 0) {
            break;
          }
        }
        if (blockList.includes(grid[agentX + op2[i][0] * (t + 1) + op2[i + 1][0] * t][agentY + op2[i][1] * (t + 1) + op2[i + 1][1] * t].goal) &&
          blockList.includes(grid[agentX + op2[i + 1][0] * (t + 1) + op2[i][0] * t][agentY + op2[i + 1][1] * (t + 1) + op2[i][1] * t].goal)) {
          for (var k = 1; k < mDist - t + 1; k++) {
            for (var h = 1; h < mDist - t + 1; h++) {
              let idx = listFoV.indexOf("(" + (agentX + op2[i][0] * (t + k) + op2[i + 1][0] * (t + h)) + "," + (agentY + op2[i][1] * (t + k) + op2[i + 1][1] * (t + h)) + ")")
              if (idx > -1) {
                listFoV.splice(idx, 1);
              }
            }
          }
        }
      }

      for (var j = 0; j < op.length; j++) {
        var tmpX = op1[i][0] + op[j][i][0];
        var tmpY = op1[i][1] + op[j][i][1];
        if (blockList.includes(grid[agentX + tmpX][agentY + tmpY].goal)) {
          let idx = listFoV.indexOf("(" + (agentX + tmpX * 2) + "," + (agentY + tmpY * 2) + ")")
          if (idx > -1) {
            listFoV.splice(idx, 1);
          }

          var tmpX3 = op1[i][0] * 2 + op[j][i][0];
          var tmpY3 = op1[i][1] * 2 + op[j][i][1];
          idx = listFoV.indexOf("(" + (agentX + tmpX3) + "," + (agentY + tmpY3) + ")")
          if (idx > -1) {
            listFoV.splice(idx, 1);
          }
        }
      }
    }

    if (listFoV.indexOf("(" + paraX + "," + paraY + ")") > -1) {
      grid[paraX][paraY].revealed = true;
      grid[paraX][paraY].drawFoV();
    } else {
      grid[paraX][paraY].revealed = false;
    }
  }
}

function isFoV(paraX, paraY, mDist) {
  var mLeft = agentX - mDist;
  var mRight = agentX + mDist;
  var mUp = agentY - mDist;
  var mDown = agentY + mDist;
  if (agentY == 0) {
    mUp = 0;
  }
  else if (agentY == height) {
    mDown = height;
  }
  if (agentX == 0) {
    mLeft = 0;
  }
  else if (agentX == width) {
    mRight = width;
  }
  return (paraX >= mLeft && paraX <= mRight && paraY >= mUp && paraY <= mDown);
}
