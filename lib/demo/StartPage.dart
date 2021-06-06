import 'package:flutter/material.dart';
import '../networking/GameCommunication.dart';
import '../demo/GamePage.dart';
import '../utils/Utils.dart';

class StartPage extends StatefulWidget {
  @override
  _StartPageState createState() => _StartPageState();
}

class _StartPageState extends State<StartPage> {
  static final TextEditingController _name = new TextEditingController();
  int playersListLength = 0;
  String gameState = '';

  @override
  void initState() {
    super.initState();

    // Todos: save user name to Shared Preference or database for next play
    _name.text = randomName();

    ///
    /// Ask to be notified when messages related to the game
    /// are sent by the server
    ///
    game.addListener(_onGameDataReceived);
  }

  @override
  void dispose() {
    game.removeListener(_onGameDataReceived);
    super.dispose();
  }

  /// -------------------------------------------------------------------
  /// This routine handles all messages that are sent by the server.
  /// In this page, only the following 2 actions have to be processed
  ///  - players_list
  ///  - new_game
  /// -------------------------------------------------------------------
  _onGameDataReceived(message) {
    print(message);
    switch (message["action"]) {
      case "matching_player":
        gameState = message["action"];
        setState(() {});
        break;

      ///
      /// Each time a new player joins, we need to
      ///   * record the new list of players
      ///
      case "players_list":
        playersListLength = message["data"];
        // force rebuild
        setState(() {});
        break;

      ///
      /// When a game is launched by another player,
      /// we accept the new game and automatically redirect
      /// to the game board.
      /// As we are not the new game initiator, we will be
      /// using the "O"
      ///
      case 'new_game':
        Navigator.push(
            context,
            new MaterialPageRoute(
              builder: (BuildContext context) => new GamePage(
                opponentName: message["data"], // Name of the opponent
                character: 'O',
              ),
            ));
        break;
    }
  }

  /// -----------------------------------------------------------
  /// If the user has not yet joined, let the user enter
  /// his/her name and join the list of players
  /// -----------------------------------------------------------
  Widget _buildJoin() {
    return new Container(
      padding: const EdgeInsets.all(16.0),
      child: new Column(
        children: <Widget>[
          // Text('Enter your name'),
          new TextField(
            controller: _name,
            keyboardType: TextInputType.text,
            decoration: new InputDecoration(
              hintText: 'Enter your name',
              contentPadding: const EdgeInsets.fromLTRB(20.0, 10.0, 20.0, 10.0),
              border: new OutlineInputBorder(
                borderRadius: new BorderRadius.circular(32.0),
              ),
              icon: const Icon(Icons.person),
            ),
          ),
          new Padding(
            padding: const EdgeInsets.all(8.0),
            child: new ElevatedButton(
              onPressed: _onGameJoin,
              child: new Text('Play'),
            ),
          ),
          Text('Online Players: ' + playersListLength.toString())
        ],
      ),
    );
  }

  Widget _buildMatching() {
    return Center(
      child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text('Welcome ' + game.playerName + ' !'),
            Text('Matching Player...')
          ]),
    );
  }

  /// --------------------------------------------------------------
  /// We launch a new Game, we need to:
  ///    * send the action "join"
  /// --------------------------------------------------------------
  _onGameJoin() {
    game.send('join', _name.text);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    Widget mainUI;
    if (gameState != 'matching_player') {
      mainUI = _buildJoin();
    } else {
      mainUI = _buildMatching();
    }
    return new SafeArea(
      bottom: false,
      top: false,
      child: Scaffold(
          appBar: new AppBar(
            title: new Text('Zodiaco'),
          ),
          body: mainUI),
    );
  }
}
