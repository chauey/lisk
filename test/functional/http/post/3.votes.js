'use strict';

var node = require('../../../node');
var shared = require('./shared');
var constants = require('../../../../helpers/constants');

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;
var creditAccount = require('../../../common/complexTransactions').creditAccount;

function registerDelegate (account, done) {
	var transaction = node.lisk.delegate.createDelegate(account.password, account.username);

	sendTransaction(transaction, function (err, res) {
		node.expect(res).to.have.property('success').to.be.ok;
		node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
		done();
	}, true);
}

describe('POST /api/transactions (type 3)', function () {

	var badTransactions = [];
	var goodTransactions = [];
	var badTransactionsEnforcement = [];
	var goodTransactionsEnforcement = [];

	var account = node.randomAccount();
	var accountNoFunds = node.randomAccount();
	var accountScarceFunds = node.randomAccount();

	var account33 = node.randomAccount();
	var delegates33 = [];

	var account101 = node.randomAccount();
	var delegates101 = [];

	var transaction;

	before(function (done) {
		// Crediting accounts
		creditAccount(account.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(accountScarceFunds.address, constants.fees.vote, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(node.eAccount.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(account33.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(account101.address, 300000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		// Creating 33 delegates
		node.async.times(33, function (n, eachCb) {
			var accounts33 = node.randomAccount();
			accounts33.username = 'delegate33@' + n;
			delegates33.push(accounts33);
			creditAccount(accounts33.address, constants.fees.delegate, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').that.is.not.empty;
				return eachCb();
			});
		}, function (err) {
			node.waitForBlocks(6, function () {
				node.async.times(33, function (n, eachCb) {
					registerDelegate(delegates33[n], function (err, res) {
						return eachCb();
					});
				});
			});
		});

		// Creating 101 delegates
		node.async.times(101, function (n, eachCb) {
			var accounts101 = node.randomAccount();
			accounts101.username = 'delegate101@' + n;
			delegates101.push(accounts101);
			creditAccount(accounts101.address, constants.fees.delegate, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').that.is.not.empty;
				return eachCb();
			});
		}, function (err) {
			node.waitForBlocks(6, function () {
				node.async.times(101, function (n, eachCb) {
					registerDelegate(delegates101[n], function (err, res) {
						return eachCb();
					});
				});
				node.waitForBlocks(6, done);
			});
		});
	});

	describe('schema validations', function () {

		shared.invalidAssets(account, 'votes', badTransactions);

		it('voting delegate with manipulated vote should fail', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['++' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid vote at index 0 - Invalid vote length');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('unvoting delegate with manipulated vote should fail', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['--' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid vote at index 0 - Invalid vote length');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('using invalid vote symbol should fail', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['x' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid vote at index 0 - Invalid vote format');
				badTransactions.push(transaction);
				done();
			}, true);
		});
	});

	describe('transactions processing', function () {

		it('voting delegates with no funds should fail', function (done) {
			accountNoFunds = node.randomAccount();
			transaction = node.lisk.vote.createVote(accountNoFunds.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account does not have enough LSK: ' + accountNoFunds.address + ' balance: 0');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('voting delegate with scarce funds should be ok', function (done) {
			transaction = node.lisk.vote.createVote(accountScarceFunds.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('unvoting delegate not voted should fail', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['-' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Failed to remove vote, account has not voted for this delegate');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('voting delegate with good schema transaction should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('self voting with good schema transaction should be ok', function (done) {
			transaction = node.lisk.vote.createVote(node.eAccount.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('voting for 33 delegates at once should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account33.password, delegates33.map(function (delegate) {
				return '+' + delegate.publicKey;
			}));

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('voting for 34 delegates at once should fail', function (done) {
			transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(0,34).map(function (delegate) {
				return '+' + delegate.publicKey;
			}));

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Voting limit exceeded. Maximum is 33 votes per transaction');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('voting for 101 delegates separately should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(0,33).map(function (delegate) {
				return '+' + delegate.publicKey;
			}));

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);

				transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(33,66).map(function (delegate) {
					return '+' + delegate.publicKey;
				}));

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactions.push(transaction);

					transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(66,99).map(function (delegate) {
						return '+' + delegate.publicKey;
					}));

					sendTransaction(transaction, function (err, res) {
						node.expect(res).to.have.property('success').to.be.ok;
						node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
						goodTransactions.push(transaction);

						transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(99,102).map(function (delegate) {
							return '+' + delegate.publicKey;
						}));

						sendTransaction(transaction, function (err, res) {
							node.expect(res).to.have.property('success').to.be.ok;
							node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
							goodTransactions.push(transaction);
							done();
						}, true);
					}, true);
				}, true);
			}, true);
		});
	});

	describe('transactions confirmation', function () {

		shared.confirmationPhase(goodTransactions, badTransactions);
	});

	describe('enforcement', function () {

		it('voting same delegate twice should fail', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Failed to add vote, account has already voted for this delegate');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('unvoting voted delegate should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['-' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('self voting twice should fail', function (done) {
			transaction = node.lisk.vote.createVote(node.eAccount.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Failed to add vote, account has already voted for this delegate');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('removing vote from self should be ok', function (done) {
			transaction = node.lisk.vote.createVote(node.eAccount.password, ['-' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('removing votes from 33 delegates at once should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account33.password, delegates33.map(function (delegate) {
				return '-' + delegate.publicKey;
			}));

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('exceeding maximum of 101 votes should fail', function (done) {
			transaction = node.lisk.vote.createVote(account101.password, ['+' + node.eAccount.publicKey]);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Maximum number of 101 votes exceeded (1 too many)');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('removing votes from 34 delegates at once should fail', function (done) {
			transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(0,34).map(function (delegate) {
				return '-' + delegate.publicKey;
			}));

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Voting limit exceeded. Maximum is 33 votes per transaction');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('voting for 101 delegates separately should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(0,33).map(function (delegate) {
				return '-' + delegate.publicKey;
			}));

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);

				transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(33,66).map(function (delegate) {
					return '-' + delegate.publicKey;
				}));

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactions.push(transaction);

					transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(66,99).map(function (delegate) {
						return '-' + delegate.publicKey;
					}));

					sendTransaction(transaction, function (err, res) {
						node.expect(res).to.have.property('success').to.be.ok;
						node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
						goodTransactions.push(transaction);

						transaction = node.lisk.vote.createVote(account101.password, delegates101.slice(99,102).map(function (delegate) {
							return '-' + delegate.publicKey;
						}));

						sendTransaction(transaction, function (err, res) {
							node.expect(res).to.have.property('success').to.be.ok;
							node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
							goodTransactions.push(transaction);
							done();
						}, true);
					}, true);
				}, true);
			}, true);
		});
	});

	describe('enforcement confirmation', function () {

		shared.confirmationPhase(goodTransactionsEnforcement, badTransactionsEnforcement);
	});
});
