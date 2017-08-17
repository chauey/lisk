'use strict';

var node = require('../../../node');
var shared = require('./shared');
var constants = require('../../../../helpers/constants');

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;
var sendLISK = require('../../../common/complexTransactions').sendLISK;

describe('POST /api/transactions (type 3)', function () {

	var badTransactions = [];
	var goodTransactions = [];
	var badTransactionsEnforcement = [];
	var goodTransactionsEnforcement = [];

	var account = node.randomAccount();
	var accountNoFunds = node.randomAccount();
	var accountScarceFunds = node.randomAccount();

	var transaction;

	// Crediting account
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
				amount: constants.fees.vote,
				address: accountScarceFunds.address
			}, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').that.is.not.empty;
				node.onNewBlock(done);
			});
		});
	});

	describe('schema validations', function () {

		shared.invalidAssets(account, 'votes', badTransactions);
	});

	describe('transactions processing', function () {

		it('voting delegates with no funds should fail', function (done) {
			accountNoFunds = node.randomAccount();
			transaction = node.lisk.vote.createVote(accountNoFunds.password, []);

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

		it('voting delegates with good schema transaction should be ok', function (done) {
			transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey]);

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
	});

	describe('enforcement confirmation', function () {

		shared.confirmationPhase(goodTransactionsEnforcement, badTransactionsEnforcement);
	});
});
