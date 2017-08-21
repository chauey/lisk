'use strict';

var node = require('../../../node');
var shared = require('./shared');
var constants = require('../../../../helpers/constants');

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;
var sendLISK = require('../../../common/complexTransactions').sendLISK;

describe('POST /api/transactions (type 1)', function () {

	var badTransactions = [];
	var goodTransactions = [];
	var badTransactionsEnforcement = [];
	var goodTransactionsEnforcement = [];

	var account = node.randomAccount();
	var accountEmptySecondPassword = node.randomAccount();
	accountEmptySecondPassword.secondPassword = '';
	var accountNoFunds = node.randomAccount();
	var accountScarceFunds = node.randomAccount();

	var transaction;

	// Crediting accounts
	before(function (done) {
		sendLISK({
			secret: node.gAccount.password,
			amount: 100000000000,
			address: account.address
		}, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
			sendLISK({
				secret: node.gAccount.password,
				amount: 100000000000,
				address: accountEmptySecondPassword.address
			}, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').that.is.not.empty;
				sendLISK({
					secret: node.gAccount.password,
					amount: constants.fees.secondsignature,
					address: accountScarceFunds.address
				}, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').that.is.not.empty;
					node.onNewBlock(done);
				});
			});
		});
	});

	describe('schema validations', function () {

		shared.invalidAssets(account, 'signature', badTransactions);
	});

	describe('transactions processing', function () {

		it('setting second secret with no funds should fail', function (done) {
			transaction = node.lisk.signature.createSignature(accountNoFunds.password, accountNoFunds.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account does not have enough LSK: ' + accountNoFunds.address + ' balance: 0');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('setting second secret with exact funds should be ok', function (done) {
			transaction = node.lisk.signature.createSignature(accountScarceFunds.password, accountScarceFunds.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('setting second secret with empty second passphrase transaction should be ok', function (done) {
			transaction = node.lisk.signature.createSignature(accountEmptySecondPassword.password, accountEmptySecondPassword.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('setting second secret with good schema transaction should be ok', function (done) {
			transaction = node.lisk.signature.createSignature(account.password, account.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});
	});

	describe('transactions confirmation', function () {

		shared.confirmationPhase(goodTransactions, badTransactions);
	});

	describe('enforcement', function () {

		describe('type 0 - sending funds', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, account.password);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, account.password, 'invalid password');

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, account.password, account.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			// TODO: waiting to fix lisk-js #285
			it.skip('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, accountEmptySecondPassword.password, accountEmptySecondPassword.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 1 - second secret', function () {

			it('setting second signature twice on the same account should be not ok', function (done) {
				transaction = node.lisk.signature.createSignature(account.password, node.randomPassword());
				var secondKeys = node.lisk.crypto.getKeys(account.secondPassword);
				node.lisk.crypto.secondSign(transaction, secondKeys);
				transaction.id = node.lisk.crypto.getId(transaction);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.not.be.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 2 - registering delegate', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.delegate.createDelegate(account.password, account.username);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.delegate.createDelegate(account.password, account.username, 'invalid password');

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.delegate.createDelegate(account.password, account.username, account.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			// TODO: waiting to fix lisk-js #285
			it.skip('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.delegate.createDelegate(accountEmptySecondPassword.password, accountEmptySecondPassword.username, accountEmptySecondPassword.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 3 - voting delegate', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey]);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey], 'invalid password');

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey], account.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			// TODO: waiting to fix lisk-js #285
			it.skip('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.vote.createVote(accountEmptySecondPassword.password, ['+' + node.eAccount.publicKey], accountEmptySecondPassword.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});
	});

	describe('enforcement confirmation', function () {

		shared.confirmationPhase(goodTransactionsEnforcement, badTransactionsEnforcement);
	});
});
