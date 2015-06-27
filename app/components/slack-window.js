(function () {
	'use strict';
	// Load in our dependencies
	var React = window.React;
	var AppDispatcher = require('../dispatchers/app');

	// Define our SlackWindow
	module.exports = React.createClass({
		// Upon page load, start listening for notification events
		addNotificationListeners: function () {
			// If this is a page with TS on it, then add listeners for unread change events
			// DEV: tinyspeck is Slack's company name, this is likely an in-house framework
			var win = this.getWindow();
			var TS = this.getTS();
			if (TS && !win._plaidchatBoundListeners) {
				// http://viewsource.in/https://slack.global.ssl.fastly.net/31971/js/rollup-client_1420067921.js#L6413-6419
				// DEV: This is the same list that is used for growl notifications (`TS.ui.growls`)
				var sig;
				if (TS.channels) {
					sig = TS.channels.unread_changed_sig; if (sig) { sig.add(this._onNotificationUpdate); }
					sig = TS.channels.unread_highlight_changed_sig; if (sig) { sig.add(this._onNotificationUpdate); }
				}
				if (TS.groups) {
					sig = TS.groups.unread_changed_sig; if (sig) { sig.add(this._onNotificationUpdate); }
					sig = TS.groups.unread_highlight_changed_sig; if (sig) { sig.add(this._onNotificationUpdate); }
				}
				if (TS.ims) {
					sig = TS.ims.unread_changed_sig; if (sig) { sig.add(this._onNotificationUpdate); }
					sig = TS.ims.unread_highlight_changed_sig; if (sig) { sig.add(this._onNotificationUpdate); }
				}
				if (TS.client) {
					sig = TS.client.login_sig; if (sig) { sig.add(this._onNotificationUpdate); }
				}
				win._plaidchatBoundListeners = true;
			}
		},

		// When React adds/removes our `iframe` to the DOM
		componentDidMount: function () {
			// Whenever the iframe loads (e.g. we change pages for logging into a team)
			var iframeEl = React.findDOMNode(this.refs.iframe);
			iframeEl.addEventListener('load', this._onload);

			// Set src ouside of React to prevent reloading due to `src` change
			var team = this.props.team || {};
			iframeEl.src = team.team_url;
		},
		componentWillUnmount: function () {
			// If we are about to unmount, remove our load listener
			var iframeEl = React.findDOMNode(this.refs.iframe);
			iframeEl.removeEventListener(this._onload);
		},

		// Element name to use inside of React
		displayName: 'slack-window',

		// Methods for accessing team information
		getAllTeams: function () {
			// [{id: user_id, name: user_name, team_id, team_name, team_url,
			//   team_icon: {image_34: http://url/34.png, image_{44,68,88,102,132}, image_default: true}}]			var win = this.getWindow();
			var win = this.getWindow();
			return win.TS.getAllTeams();
		},
		getThisTeam: function () {
			// {id: id (team), name: name (team), domain: 'plaidchat-test', email_domain: 'mailinator.com',
			//   msg_edit_window_mins, prefs: {default_channels, ...},
			//   icon: {image_34: http://url/34.png, image_{44,68,88,102,132}, image_default: true},
			//   over_storage_limit, plan, url: wss://ms144.slack-msgs.com, activity}
			var win = this.getWindow();
			return win.TS.model.team;
		},
		getUrl: function () {
			var iframeEl = React.findDOMNode(this.refs.iframe);
			return iframeEl.contentWindow.location.href;
		},
		getTS: function () {
			var win = this.getWindow();
			return win.TS;
		},
		getWindow: function () {
			var iframeEl = React.findDOMNode(this.refs.iframe);
			return iframeEl.contentWindow;
		},

		// Listeners for iframe/Slack events
		_onload: function () {
			// When our page loads, hook up listeners
			this.addNotificationListeners();
			this.resetTeamsLoaded();
			this.watchTeamsLoaded();

			this.getWindow().addEventListener('contextmenu', this._onContextMenu);
		},
		_onContextMenu: function (e) {
	      e.preventDefault();

	      console.debug('Context menu.' + e.x + ',' + e.y);
	      this.props.onContextMenu(e, this.props.team.team_url);
		},
		_onNotificationUpdate: function () {
			// When our notification count changes, emit an event for the team with our unread count
			// http://viewsource.in/https://slack.global.ssl.fastly.net/31971/js/rollup-client_1420067921.js#L6497
			// TODO: Slack makes a distinction between highlights (e.g. @mentions) and normal messages (e.g. chat)
			//   we should consider doing that too. The variable for this is `TS.model.all_unread_highlights_cnt`.
			AppDispatcher.dispatch({
				type: AppDispatcher.ActionTypes.NOTIFICATION_UPDATE,
				teamId: this.getThisTeam().id,
				notificationCount: this.getTS().model.all_unread_cnt
			});
		},

		// Tell react the type of data that we expect
		propTypes: {
			active: React.PropTypes.bool,
			team: React.PropTypes.shape({
				team_id: React.PropTypes.string,
				team_url: React.PropTypes.string.isRequired
			}).isRequired
		},

		// Whenever an update event occurs, this updates the virtual DOM for react
		//   If any changes occurred, then React will update the real dom with those changes
		render: function () {
			var $iframe = React.DOM.iframe({
				className: this.props.active ? 'slack-window slack-window--active' : 'slack-window hidden',
				frameBorder: '0',
				nwdisable: true,
				nwfaketop: true,
				ref: 'iframe'
			});
			return $iframe;
		},

		// Methods for interacting with teams
		resetTeamsLoaded: function () {
			// Stop the current loop for teams loaded
			console.debug('An iframe reloaded, clearing out its existing `watchTeamsLoaded` timeout');
			clearTimeout(this.teamsLoadedTimeout);
		},
		teamsLoaded: function () {
			var win = this.getWindow();
			return win &&  win.TS && win.TS.getAllTeams && win.TS.getAllTeams();
		},
		watchTeamsLoaded: function () {
			// If we haven't completed loading yet, wait for 100ms
			if (!this.teamsLoaded()) {
				console.debug('Teams not loaded yet for "' + this.getUrl() + '". Waiting 100ms');
				return setTimeout(this.watchTeamsLoaded, 100);
			}

			// Otherwise, update the teams
			console.debug('Teams loaded for "' + this.getUrl() + '". Updating properties');
			var thisTeam = this.getThisTeam();
			AppDispatcher.dispatch({
				type: AppDispatcher.ActionTypes.TEAMS_UPDATE,
				// Alias the current iframe's key to its new key
				// DEV: This is no cost if the key is already the same
				//   However, if it's a placeholder being converted to a window then we need this
				// 	This avoids reloading of our iframe because the key will stay consistent
				alias: {
					srcTeamId: this.props.team.team_id,
					targetTeamId: thisTeam.id
				},
				// `getAllTeams` does not have `team_icon` set for `thisTeam` so we set it here
				teamIcon: {
					teamId: thisTeam.id,
					teamIcon: thisTeam.icon
				},
				// Send all team info
				allTeams: this.getAllTeams()
			});
		}
	});
}());
