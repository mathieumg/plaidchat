(function () {
	'use strict';
	// Load in our dependencies
	var gui = require('nw.gui');
	var url = require('url');
	var program = require('commander');
	var AppMenu = window.AppMenu;
	var React = window.React;
	// DEV: Relative paths are resolved from `views/index.html`
	var SlackApplication = require('../components/slack-application');
	var pkg = require('../../package.json');

	// Define our constants
	var win = gui.Window.get();
	var SLACK_DOWNLOAD_HOSTNAME = 'files.slack.com';

	// Interpet our CLI arguments
	// DEV: We need to coerce `nw.js'` arguments as `commander` expects normal (`['node', 'plaidchat', '--help']`)
	//   but `nw.js` only provides arguments themselves (e.g. `--help`)
	var argv = ['nw', pkg.name].concat(gui.App.argv);
	program
			.version(pkg.version)
			.parse(argv);

	win.on('new-win-policy', function (frame, urlStr, policy) {
		// Determine where the request is to
		var openRequest = url.parse(urlStr);

		// If the request is for a file, download it
		// DEV: Files can be found on `files.slack.com`
		//   https://files.slack.com/files-pri/{{id}}/download/tmp.txt
		if (openRequest.hostname === SLACK_DOWNLOAD_HOSTNAME) {
			policy.forceDownload();
			console.debug('Downloading file: ', urlStr);
			return;
		}

		// Otherwise, open the window via our browser
		// DEV: An example request is a redirect
		//   https://slack-redir.net/link?url=http%3A%2F%2Fgoogle.com%2F
		gui.Shell.openExternal(urlStr);
		policy.ignore();
		console.debug('Allowing browser to handle: ' + JSON.stringify(openRequest));
	});

	// Keep track of minimization
	var isMinimized = false;
	win.on('minimize', function () {
		isMinimized = true;
	});
	win.on('restore', function () {
		isMinimized = false;
	});

	var linkMenu;
	var lastUrl = "";

	// Define a global set of controls for `plaidchat`
	var plaidchat = {
		// Method to exit our application
		exit: function () {
			console.debug('Exiting plaidchat...');
			process.exit();
		},
		// Method to reload our window
		reload: function () {
			win.reload();
		},
		// Method to start our application
		load: function () {
			// Bind our app menu to the window
			AppMenu.bindTo(win);

			// Setup initial team
			SlackApplication.loadInitialTeams();

			// Make right-click menu.
			var self = this;
			linkMenu = new gui.Menu();
			linkMenu.append(new gui.MenuItem({
        label: 'Open URL',
        click: function() {
          console.debug("Opening url: " + lastUrl);
          gui.Shell.openExternal(lastUrl);
        }
    	}));
    	linkMenu.append(new gui.MenuItem({
        label: 'Copy URL',
        click: function() {
          console.debug("Copying url: " + lastUrl);
          gui.Clipboard.get().set(lastUrl);
        }
    	}));

			// Render our application
			var slackApp = React.createElement(SlackApplication, {onContextMenu: this.showRightClickMenu});
			plaidchat.app = React.render(slackApp, document.body);
			console.debug('Starting application...');
		},
		openAboutWindow: function () {
			gui.Window.open('about.html', {
				height: 200,
				width: 400,
				toolbar: false
			});
		},
		showRightClickMenu: function (e, teamUrl) {
			console.debug("Showing right-click menu.");
			var node = e.target;

      if (node.tagName === "A") {
      	console.debug("link: " + node.attributes[0].nodeValue);
      	lastUrl = node.attributes[0].nodeValue;
      	if (lastUrl.charAt(0) === "/") {
      		lastUrl = teamUrl.substring(0, teamUrl.length - 1) + lastUrl;
      	}
      	linkMenu.popup(e.x, e.y);
      }
		},
		// Method to open our dev tools (hooray development :tada:)
		toggleDevTools: function () {
			if (win.isDevToolsOpen()) {
				win.closeDevTools();
			} else {
				win.showDevTools();
			}
		},
		// Method to toggle window visibility
		toggleVisibility: function () {
			if (isMinimized) {
				win.restore();
			} else {
				win.minimize();
			}
		}
	};
	window.plaidchat = plaidchat;
})();
