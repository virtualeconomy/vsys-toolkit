import { VsysLib } from "../src/wallet.js";
import * as jv from "@virtualeconomy/js-vsys";
import { expect } from "chai";

describe("Vsys toolkit", () => {
    var library;
    var newWalletAddress;
    var newSeed;

    before(() => {
        library = new VsysLib(process.env.HOST, process.env.CHAIN, process.env.TOKEN_CONTRACT_ID, process.env.SLEEP_TIME, process.env.POOL_WALLET_SEED);
    });
    after(async () => {
        var acnt = library.getAcntFromSeed(newSeed);
        var txn = await acnt.pay(library.poolWalletAddress, 12.9);
        await library.waitForConfirm(txn.id);
    });

    describe("createNewWal function", () => {
        it("create a wallet", () => {
            var wallet = library.createNewWal();
            newWalletAddress = wallet[1];
            var addr = new jv.Addr(newWalletAddress);
            addr.validate();
            newSeed = wallet[0];
            var count = newSeed.split(' ').length;
            expect(count).to.equal(15);
        });
    });

    describe("getVsysFromPool function", () => {
        it("Get vsys coin from pool", async () => {
            var oldBal = await library.api.addr.getBalance(newWalletAddress);
            await library.getVsysFromPool(newWalletAddress);
            var newBal = await library.api.addr.getBalance(newWalletAddress);
            expect(oldBal.balance + newBal.balance).to.equal(600000000);
        });
        it("Get custom vsys coin from pool", async () => {
            var oldBal = await library.api.addr.getBalance(newWalletAddress);
            await library.getVsysFromPool(newWalletAddress, 7);
            var newBal = await library.api.addr.getBalance(newWalletAddress);
            expect(newBal.balance - oldBal.balance).to.equal(700000000);
        });
    });
    describe("sendToken & getTokenBalance function", () => {
        it("send token and get token balance", async () => {
            var txn = await library.sendToken(library.poolWalletSeed, 1, newWalletAddress);
            await library.waitForConfirm(txn.id);
            var bal = await library.getTokenBalance(newWalletAddress);
            expect(bal.toNumber()).to.equal(1);
        });
    });
});
