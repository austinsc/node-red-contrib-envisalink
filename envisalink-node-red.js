'use strict';
const EnvisaLink = require('./envisalink.js');

module.exports = function (RED) {
  function EnvisaLinkInNode(config) {
    RED.nodes.createNode(this, config);
    const _this = this;
    this.controller = config.controller;
    this.controllerConn = RED.nodes.getNode(this.controller);

    if (this.controllerConn) {
      this.status({ fill: 'orange', shape: 'ring', text: 'Connecting...' });
      this.controllerConn.register(this);
    } else {
      this.error(RED._('Missing controller configuration'));
    }

    this.on('el-zoneupdate', function (update) {
      if (!update.initialUpdate) {
        delete update.initialUpdate;
        const msg = {topic: 'zone event', payload: update};
        _this.send(msg);
      }
    });

    this.on('el-partitionupdate', function (update) {
      if (!update.initialUpdate) {
        delete update.initialUpdate;
        const msg = {topic: 'partition event', payload: update};
        _this.send(msg);
      }
    });

    this.on('el-systemupdate', function (update) {
      if (!update.initialUpdate) {
        delete update.initialUpdate;
        const msg = {topic: 'system event', payload: update};
        _this.send(msg);
      }
    });

    this.on('close', function (done) {
       if (_this.controllerConn) {
         _this.controllerConn.deregister(_this, done);
       }
     });
  }

  RED.nodes.registerType('envisalink in', EnvisaLinkInNode);

  function EnvisaLinkOutNode(config) {
    RED.nodes.createNode(this, config);
    const _this = this;
    this.controller = config.controller;
    this.controllerConn = RED.nodes.getNode(this.controller);

    if (this.controllerConn) {
      this.status({ fill: 'orange', shape: 'ring', text: 'Connecting...' });
      this.controllerConn.register(this);
    } else {
      this.error(RED._('Missing controller configuration'));
    }

    this.on('input', function (msg) {
      _this.controllerConn.sendCommand(msg.payload);
      _this.send(msg);
    });

    this.on('close', function (done) {
       if (_this.controllerConn) {
         _this.controllerConn.deregister(_this, done);
       }
     });
  }

  RED.nodes.registerType('envisalink out', EnvisaLinkOutNode);

  function EnvisaLinkControllerNode(config) {
    const _this = this;
    this.host = config.host;
    this.port = config.port;
    this.password = this.credentials.password;
    config.password = this.password;
    config.atomicEvents = false;
    this.connected = false;
    this.connecting = false;

    this.el = new EnvisaLink(config);

    this.users = {};

    this.register = function (elNode) {
      _this.users[elNode.id] = elNode;
      if (Object.keys(_this.users).length === 1) {
        if (!_this.connected && !_this.connecting) {
          _this.connecting = true;
          _this.el.connect();
        }
      }
    };

    this.deregister = function (elNode, done) {
      delete _this.users[elNode.id];
      if (_this.closing) {
        return done();
      }

      if (Object.keys(_this.users).length === 0) {
        _this.done = done;
        _this.el.disconnect();
      } else {
        done();
      }
    };

    this.el.on('connected', function () {
      for (let id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].status({ fill:'green', shape:'dot', text:'Connected' });
        }
      }
    });

    this.el.on('error', function () {
      _this.log(RED._('Disconnected from ' + _this.host + ':' + _this.port));
      for (let id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].status({ fill:'red', shape:'ring', text:'Disconnected' });
        }
      }
    });

    this.el.on('log-debug', function (text) {
      _this.log(RED._(text));
    });

    this.el.on('log-warn', function (text) {
      _this.warn(RED._(text));
    });

    this.el.on('log-error', function (text) {
      _this.error(RED._(text));
    });

    this.el.on('zoneupdate', function (update) {
      for (let id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].emit('el-zoneupdate', update);
        }
      }
    });

    this.el.on('partitionupdate', function (update) {
      for (let id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].emit('el-partitionupdate', update);
        }
      }
    });

    this.el.on('systemupdate', function (update) {
      for (let id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].emit('el-systemupdate', update);
        }
      }
    });

    this.sendCommand = function (command) {
      this.el.sendCommand(command);
    }.bind(this);

    this.el.on('disconnect', function () {
      if (_this.done !== undefined) {
        _this.done();
        _this.done = null;
      }

      _this.log(RED._('Disconnected from ' + _this.host + ':' + _this.port));
      for (let id in _this.users) {
        if (_this.users.hasOwnProperty(id)) {
          _this.users[id].status({ fill:'red', shape:'ring', text:'Disconnected' });
        }
      }
    });

    this.on('close', function (done) {
      _this.log(RED._('Closing Envisalink', {}));
      _this.closing = true;
      _this.connected = false;
      _this.connecting = false;
      _this.done = done;
      const wasDisconnected = _this.el.disconnect();
      if (wasDisconnected) {
        _this.done = null;
        done();
      }
    });
  }
  RED.nodes.registerType('envisalink-controller', EnvisaLinkControllerNode, {
    credentials: {
      password: { type: 'password' }
    }
  });
};
