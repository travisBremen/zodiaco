/**
 * Code adapted from
 * https://www.didierboelens.com/2018/06/web-sockets-build-a-real-time-game/
 */

/**
 * Parameters
 */
var webSocketsServerPort = 23456; // Adapt to the listening port number you want to use
/**
 * Global variables
 */
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function (req, res) {
  res.writeHead(200);
  res.end("hello world\n");
})

server.listen(webSocketsServerPort);


const PLAYERSTATES = {
  uninitialized: 0,
  matching: 1,
  matched: 2,
  ready: 3,
  playing: 4,
  waiting: 5,
  over: 6
}

const MESSAGE = {}
// /**
//  * WebSocket server
//  */
var wsServer = new webSocketServer({
  // WebSocket server is tied to a HTTP server. WebSocket
  // request is just an enhanced HTTP request. For more info
  // http://tools.ietf.org/html/rfc6455#page-6
  httpServer: server
});

// // This callback function is called every time someone
// // tries to connect to the WebSocket server
wsServer.on('request', function (request) {
  var connection = request.accept(null, request.origin);

  //
  // New Player has connected.  So let's record its socket
  //
  var player = new Player(request.key, connection);

  //
  // Add the player to the list of all players
  //
  Players.push(player);

  //
  // We need to return the unique id of that player to the player itself
  //
  player.sendMsg({
    action: 'connect',
    data: player.id
  });

  //
  // Inform other player to update online player number
  //
  console.log('Player join, id:', player.id)
  BroadcastPlayersList();

  //
  // Listen to any message sent by that player
  //
  connection.on('message', function (data) {
    //
    // Process the requested action
    //
    var message = JSON.parse(data.utf8Data);
    console.log(message)

    if (message.action != 'join' && player.state == PLAYERSTATES.uninitialized) return
    switch (message.action) {
      //
      // When the user sends the "join" action, he provides a name.
      // Let's record it and as the player has a name, let's
      // broadcast the list of all the players to everyone
      //
      case 'join':
        player.name = message.data;
        player.state = PLAYERSTATES.matching;
        player.sendMsg({
          'action': 'matching_player'
        });
        MatchPlayer();
        break;

      case 'ready':
        player.state = PLAYERSTATES.ready;
        DealCards(player);
        break;
        //
        // When a player resigns, we need to break the relationship
        // between the 2 players and notify the other player
        // that the first one resigned
        //
      case 'resign':
        Players[player.opponentIndex] && Players[player.opponentIndex].sendMsg({
          'action': 'resigned'
        });
        player.opponentIndex = null;
        break;

        //
        // A player sends a guess
        //
      case 'play':
        checkGuess(player, message.data)
        checkGameover(player)
        break;
        //
        // A player select a opponent's card
        //
      case 'select_card':
        Players[player.opponentIndex] && Players[player.opponentIndex].sendMsg({
          'action': 'select_card',
          'data': message.data
        });
        break;
        //
        // A player takes punishment
        //
      case 'punish':
        punish(player, message.data)
        checkGameover(player)
        break;
        //
        // A player takes punishment
        //
      case 'skip':
        // punish(player, message.data)
        switchTurn(player, false)

        break;
    }
  });

  // user disconnected
  connection.on('close', function (connection) {
    // We need to remove the corresponding player
    console.log('Player left, id:', player.id)
    Players = Players.filter(function (obj) {
      return obj.id !== player.id;
    });
    BroadcastPlayersList();
  });
});

// -----------------------------------------------------------
// List of all players
// -----------------------------------------------------------
var Players = [];

function Player(id, connection) {
  this.id = id;
  this._connection = connection;
  this.name = "";
  this.opponentIndex = null;
  this.index = Players.length;
  this.state = PLAYERSTATES.uninitialized;
  this.cards = [];
}

Player.prototype = {
  getId: function () {
    return {
      name: this.name,
      id: this.id
    };
  },
  sendMsg: function (msg) {
    this._connection && this._connection.sendUTF(JSON.stringify(msg))
  },
  setOpponent: function (id) {
    var self = this;
    Players.forEach(function (player, index) {
      if (player.id == id) {
        self.opponentIndex = index;
        Players[index].opponentIndex = self.index;
        return false;
      }
    });
  }
};

// ---------------------------------------------------------
// Routine to broadcast the list of all players to everyone
// ---------------------------------------------------------
function BroadcastPlayersList() {
  Players.forEach(function (player) {
    player.sendMsg({
      'action': 'players_list',
      'data': Players.length
    });
  });
}

// ---------------------------------------------------------
// Match players
// ---------------------------------------------------------
function MatchPlayer() {
  let matchingList = Players.filter(player => player.state === PLAYERSTATES.matching).slice(0, 2)
  if (matchingList.length != 2) return

  let firstPlayer = matchingList[0]
  let secondPlayer = matchingList[1]

  firstPlayer.state = PLAYERSTATES.matched
  secondPlayer.state = PLAYERSTATES.matched

  firstPlayer.setOpponent(secondPlayer.id)
  secondPlayer.setOpponent(firstPlayer.id)

  firstPlayer.sendMsg({
    'action': 'new_game',
    'data': secondPlayer.name
  })
  secondPlayer.sendMsg({
    'action': 'new_game',
    'data': firstPlayer.name
  })
}

// ---------------------------------------------------------
// Deal cards
// ---------------------------------------------------------
function DealCards(player) {
  let opponent = Players[player.opponentIndex]
  // wait until opponent ready
  if (opponent.state != PLAYERSTATES.ready) return
  const maxValue = 12
  const splitSize = 10
  // Generate cards
  let allBlackCards = Array.from(Array(maxValue).keys()).map(v => {
    return {
      show: 0,
      value: v + 1,
      color: 'black'
    }
  })
  let allWhiteCards = allBlackCards.map(v => {
    return {
      show: 0,
      value: v.value,
      color: 'white'
    }
  })
  let allCardsVal = _shuffle(allBlackCards.concat(allWhiteCards))
  // sort cards
  let cards1 = allCardsVal.slice(0, splitSize).sort(_sort)
  let cards2 = allCardsVal.slice(splitSize, splitSize * 2).sort(_sort)

  player.cards = cards1
  opponent.cards = cards2
  updateCards(player)
  console.log('New Game')
  switchTurn(player, Math.random() > 0.5)
}

// ---------------------------------------------------------
// Sort cards helper function
// According to it number and color (white is greater than black)
// ---------------------------------------------------------
function _sort(a, b) {
  if (a.value < b.value) {
    return -1
  }
  if (a.value == b.value && a.color == 'white') {
    return -1
  }
  return 0
}
// ---------------------------------------------------------
// Shuffle cards helper function
// ---------------------------------------------------------
function _shuffle(array) {
  var currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]
    ];
  }

  return array;
}

// ---------------------------------------------------------
// Check if game is over
// ---------------------------------------------------------
function checkGameover(player) {
  let opponent = Players[player.opponentIndex]
  // check if one of the player's cards are all unfolded
  if (_isAllCardsUnfolded(player.cards)) {
    _sendResultMsg(opponent)
    _sendGameoverMsg()
  }

  if (_isAllCardsUnfolded(opponent.cards)) {
    _sendResultMsg(player)
    _sendGameoverMsg()
  }

  function _sendGameoverMsg() {
    player.sendMsg({
      'action': 'gameover'
    })
    opponent.sendMsg({
      'action': 'gameover'
    })
  }

  function _sendResultMsg(winner) {
    winner.sendMsg({
      'action': 'hint_update',
      'data': 'You win!'
    })
    Players[winner.opponentIndex].sendMsg({
      'action': 'hint_update',
      'data': 'You lost!'
    })
  }

  function _isAllCardsUnfolded(arr) {
    return arr.map(v => v.show).reduce((a, b) => a + b) == arr.length
  }
}

// ---------------------------------------------------------
// Check guess result
// ---------------------------------------------------------
function switchTurn(player, turn) {
  let opponent = Players[player.opponentIndex]
  let turnHint = 'Your turn! Click opponent\'s card and guess the number.'
  let waitHint = '\'s turn.'
  player.sendMsg({
    'action': 'switch_turn',
    'data': turn
  })
  opponent.sendMsg({
    'action': 'switch_turn',
    'data': !turn
  })

  player.sendMsg({
    'action': 'hint_update',
    'data': turn ? turnHint : opponent.name + waitHint
  })
  opponent.sendMsg({
    'action': 'hint_update',
    'data': turn ? player.name + waitHint : turnHint
  })

  Players[player.opponentIndex] && Players[player.opponentIndex].sendMsg({
    'action': 'select_card',
    'data': '-1'
  });
  console.log(`${turn ? player.name: opponent.name}\'s turn.`)
}

// ---------------------------------------------------------
// Check guess result
// ---------------------------------------------------------
function checkGuess(player, data) {
  let opponent = Players[player.opponentIndex]
  let index = parseInt(data.split(',')[0])
  let guessNum = parseInt(data.split(',')[1])
  if (guessNum == opponent.cards[index]['value']) {
    opponent.cards[index]['show'] = 1
    updateCards(player)
    player.sendMsg({
      'action': 'hint_update',
      'data': 'Correct! Continue guessing or skip this round.'
    })
    player.sendMsg({
      'action': 'show_skip',
      'data': true
    })
    opponent.sendMsg({
      'action': 'hint_update',
      'data': `${player.name} correctly guessed this card.`
    })
  } else {
    player.sendMsg({
      'action': 'hint_update',
      'data': `Guessed wrong! That is not a ${guessNum}. Turn over one of your card.`
    })

    player.sendMsg({
      'action': 'punish'
    })
    player.sendMsg({
      'action': 'show_skip',
      'data': false
    })
    opponent.sendMsg({
      'action': 'hint_update',
      'data': `${player.name} guessed this is a ${guessNum}. :)`
    })
  }
}


// ---------------------------------------------------------
// Unfold players' own cards
// ---------------------------------------------------------
function punish(player, data) {
  let index = parseInt(data)
  player.cards[index]['show'] = 1
  updateCards(player)
  switchTurn(player, false)
}

// ---------------------------------------------------------
// Update cards display state
// ---------------------------------------------------------
function updateCards(player) {
  let opponent = Players[player.opponentIndex]
  player.sendMsg({
    'action': 'cards_update',
    'data': {
      'myCard': player.cards,
      'opponentsCard': opponent.cards
    }
  })
  opponent.sendMsg({
    'action': 'cards_update',
    'data': {
      'myCard': opponent.cards,
      'opponentsCard': player.cards
    }
  })
}
