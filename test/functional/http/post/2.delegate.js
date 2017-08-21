'use strict';

var node = require('../../../node');
var shared = require('./shared');
var constants = require('../../../../helpers/constants');

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;
var creditAccount = require('../../../common/complexTransactions').creditAccount;

describe('POST /api/transactions (type 2)', function () {

	var badTransactions = [];
	var goodTransactions = [];
	var badTransactionsEnforcement = [];
	var goodTransactionsEnforcement = [];

	var account = node.randomAccount();
	var accountNoFunds = node.randomAccount();
	var accountScarceFunds = node.randomAccount();

	var transaction;

	// Crediting accounts
	before(function (done) {

		creditAccount(account.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(accountScarceFunds.address, constants.fees.delegate, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
			node.onNewBlock(done);
		});
	});

	describe('schema validations', function () {

		shared.invalidAssets(account, 'delegate', badTransactions);
	});

	describe('transactions processing', function () {

		it('setting delegate with no funds should fail', function (done) {
			accountNoFunds = node.randomAccount();
			transaction = node.lisk.delegate.createDelegate(accountNoFunds.password, accountNoFunds.username);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account does not have enough LSK: ' + accountNoFunds.address + ' balance: 0');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('setting second secret with exact funds should be ok', function (done) {
			transaction = node.lisk.delegate.createDelegate(accountScarceFunds.password, accountScarceFunds.username);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('setting delegate with good schema transaction should be ok', function (done) {
			transaction = node.lisk.delegate.createDelegate(account.password, account.username);
			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		// TODO: bug #729
		// it('setting delegate twice with good schema transaction should be ok', function (done) {
		// 	transaction = node.lisk.delegate.createDelegate(account.password, node.randomDelegateName());
		// 	sendTransaction(transaction, function (err, res) {
		// 		node.expect(res).to.have.property('success').to.be.ok;
		// 		node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
		// 		goodTransactions.push(transaction);
		// 		done();
		// 	}, true);
		// });
	});

	describe('transactions confirmation', function () {

		shared.confirmationPhase(goodTransactions, badTransactions);
	});

	describe('enforcement', function () {

		it('setting same delegate twice should fail', function (done) {
			transaction = node.lisk.delegate.createDelegate(account.password, account.username);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account is already a delegate');
				badTransactionsEnforcement.push(transaction);
				done();
			}, true);
		});

		it('updating registered delegate should fail', function (done) {
			transaction = node.lisk.delegate.createDelegate(account.password, 'newusername');

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account is already a delegate');
				badTransactionsEnforcement.push(transaction);
				done();
			}, true);
		});
	});

	describe('enforcement confirmation', function () {

		shared.confirmationPhase(goodTransactionsEnforcement, badTransactionsEnforcement);
	});
});
