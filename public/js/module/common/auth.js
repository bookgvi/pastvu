/*global define:true*/
define(['jquery', 'Utils', '../../socket', 'Params', 'knockout', 'm/_moduleCliche', 'globalVM', 'm/storage', 'm/User', 'KeyHandler', 'text!tpl/common/auth.jade', 'css!style/common/auth'], function ($, Utils, socket, P, ko, Cliche, globalVM, storage, User, keyTarget, jade) {
	'use strict';

	return Cliche.extend({
		jade: jade,
		create: function () {
			this.iAm = User.vm();
			this.loggedIn = ko.observable(false);

			this.mode = ko.observable('login');
			this.working = ko.observable(false);

			this.msg = ko.observable('');
			this.caps = ko.observable(false);

			this.subscriptions.mode = this.mode.subscribe(function () {
				this.formFocus();
			}, this);

			ko.applyBindings(globalVM, this.$dom[0]);
		},
		show: function (mode, callback, ctx) {
			if (mode) {
				this.mode(mode);
			}

			if (callback) {
				this.callback = callback;
				this.ctx = ctx || window;
			}

			globalVM.func.showContainer(this.$container, function () {
				this.showing = true;
				this.formFocus();

				keyTarget.push({
					id: 'authOverlay',
					stopFurther: false,
					onEsc: this.formClose.bind(this)
				});
			}, this);
		},
		hide: function () {
			keyTarget.pop();
			this.formReset();
			globalVM.func.hideContainer(this.$container);
			this.showing = false;
		},

		pressHandler: function (vm, event) {
			this.caps(Utils.capsLockDetect(event));
			return true;
		},

		formFocus: function () {
			window.setTimeout(function () {
				try {
					this.$dom.children('form:visible')[0].querySelector('input:first-child:not([disabled])').focus();
				} catch (e) {
				}
			}.bind(this), 200);
		},
		formReset: function () {
			this.$dom.find(':focus').blur();
			this.$dom.find("input").val(null);
			this.$dom.find(".mess").height(0).removeClass('text-error text-warning text-info text-success muted');
			this.msg('');
			this.formWorking(false);
			this.caps(false);
		},
		formClose: function () {
			if (Utils.isType('function', this.callback)) {
				this.callback.call(this.ctx, {loggedIn: false});
			}
			this.hide();
		},
		formWorking: function (param) {
			this.working(param);
			this.$dom.find('form:visible').find('input, button').attr('disabled', param);
		},
		setMessage: function (text, type) {
			var css = '';
			switch (type) {
			case 'error':
				css = 'text-error';
				break;
			case 'warn':
				css = 'text-warning';
				break;
			case 'info':
				css = 'text-info';
				break;
			case 'success':
				css = 'text-success';
				break;
			default:
				css = 'muted';
				break;
			}

			this.msg(text);
			this.$dom.find('form:visible .mess')
				.addClass(css)
				.css({height: 5 + this.$dom.find('form:visible .mess > div').height()});

			text = type = css = null;
		},
		submit: function () {
			var form = this.$dom.find('form:visible');
			form.find(':focus').blur();

			try {
				if (this.mode() === 'login') {
					this.doLogin(
						$.extend(form.serializeObject(), {'remember': form[0].querySelector('#remember').classList.contains('checked')}),
						function (data) {
							if (data.error) {
								this.setMessage(data.message, 'error');
								window.setTimeout(function () {
									this.formWorking(false);
									this.formFocus();
								}.bind(this), 420);
							} else {
								if (Utils.isType('function', this.callback)) {
									this.callback.call(this.ctx, {loggedIn: true});
								}
								this.hide();
							}
						}.bind(this)
					);

				} else if (this.mode() === 'reg') {
					this.doRegister(
						$.extend(form.serializeObject(), {}),
						function (data) {
							if (data.error) {
								this.setMessage(data.message, 'error');
								window.setTimeout(function () {
									this.formFocus();
									this.formWorking(false);
								}.bind(this), 420);
							} else {
								form.find('button').css('display', 'none');
								form.find('.formfinish').css('display', '');
								this.setMessage(data.message, 'success');
								window.setTimeout(function () {
									this.formWorking(false);
								}.bind(this), 420);
							}
						}.bind(this)
					);
				} else if (this.mode() === 'recall') {
					this.doPassRecall(
						$.extend(form.serializeObject(), {}),
						function (data) {
							if (data.error) {
								this.setMessage(data.message, 'error');
								window.setTimeout(function () {
									this.formFocus();
									this.formWorking(false);
								}.bind(this), 420);
							} else {
								form.find('button').css('display', 'none');
								form.find('.formfinish').css('display', '');
								this.setMessage(data.message, 'success');
								window.setTimeout(function () {
									this.formWorking(false);
								}.bind(this), 420);
							}
						}.bind(this)
					);
				} else if (this.mode() === 'passChange') {
					this.doPassChange(
						$.extend(form.serializeObject(), {login: this.iAm.login()}),
						function (data) {
							if (data.error) {
								this.setMessage(data.message, 'error');
								window.setTimeout(function () {
									this.formFocus();
									this.formWorking(false);
								}.bind(this), 420);
							} else {
								form.find('button').css('display', 'none');
								form.find('.formfinish').css('display', '');
								this.setMessage(data.message, 'success');
								window.setTimeout(function () {
									this.formWorking(false);
								}.bind(this), 420);
							}
						}.bind(this)
					);
				}

				this.formWorking(true);
			} catch (e) {
				this.setMessage(e.message, 'error');
				this.formWorking(false);
			}

			return false;
		},

		processMe: function (user) {
			this.loggedIn(true);
			this.iAm = User.vm(user, this.iAm);
			storage.users[user.login] = {origin: user, vm: this.iAm};

			console.log(this.iAm.fullName());

			//При изменении данных профиля на сервере, обновляем его на клиенте
			socket
				.removeAllListeners('youAre')
				.on('youAre', function (user) {
					if (this.iAm.login() === user.login) {
						this.iAm = User.vm(user, this.iAm);
						console.log(this.iAm.fullName());
					}
				}.bind(this));
		},
		loadMe: function () {
			var dfd = $.Deferred();
			socket.once('youAre', function (user) {
				if (user) {
					this.processMe(user);
				}
				// Резолвим асинхронно, чтобы пересчитались computed зависимости других модулей от auth
				window.setTimeout(dfd.resolve.bind(dfd), 50);
			}.bind(this));
			socket.emit('whoAmI');
			return dfd.promise();
		},
		doLogin: function (data, callback) {
			try {
				socket.once('loginResult', function (json) {
					if (!json.error && json.youAre) {
						this.processMe(json.youAre);
					}

					if (Utils.isType('function', callback)) {
						callback(json);
					}
				}.bind(this));
				socket.emit('loginRequest', data);
			} catch (e) {
				if (Utils.isType('function', callback)) {
					callback(e.message);
				}
			}
		},
		doLogout: function (callback) {
			try {
				socket.once('logoutResult', function (json) {
					if (json.error) {
						console.log('Logout error' + json.message);
					} else {
						document.location = json.logoutPath;
					}
				});
				socket.emit('logoutRequest', {});
			} catch (e) {
				if (Utils.isType('function', callback)) {
					callback(e.message);
				}
			}
		},
		doRegister: function (data, callback) {
			try {
				socket.once('registerResult', function (json) {
					if (Utils.isType('function', callback)) {
						callback(json);
					}
				});
				socket.emit('registerRequest', data);
			} catch (e) {
				if (Utils.isType('function', callback)) {
					callback(e.message);
				}
			}
		},
		doPassRecall: function (data, callback) {
			try {
				socket.once('recallResult', function (json) {
					if (Utils.isType('function', callback)) {
						callback(json);
					}
				});
				socket.emit('recallRequest', data);
			} catch (e) {
				if (Utils.isType('function', callback)) {
					callback(e.message);
				}
			}
		},
		doPassChange: function (data, callback) {
			try {
				socket.once('passChangeResult', function (json) {
					if (Utils.isType('function', callback)) {
						callback(json);
					}
				});
				socket.emit('passChangeResult', data);
			} catch (e) {
				if (Utils.isType('function', callback)) {
					callback(e.message);
				}
			}
		}

	});
});