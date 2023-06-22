import { VsysLib } from "../src/wallet.js";
import * as jv from "@virtualeconomy/js-vsys";
import * as utils from "@virtualeconomy/js-vsys/src/utils/curve_25519.js";
import { expect } from "chai";

describe("Vsys toolkit", () => {
    var library;
    var newWalletAddress;
    var newSeed;

    before(() => {
        library = new VsysLib(process.env.HOST, process.env.CHAIN, process.env.SLEEP_TIME, process.env.POOL_WALLET_SEED, 0, process.env.TOKEN_CONTRACT_ID);
    });
    after(async () => {
        const [acnt, seed, wallet] = library.getVsysAccountInfo(newSeed);
        var bal = await library.getVsysBalance(newSeed);
        var txn = await acnt.pay(library.poolWalletAddress, bal - 0.1);
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
            var txn = await library.sendToken(1, library.poolWalletSeed, newWalletAddress);
            await library.waitForConfirm(txn.id);
            var bal = await library.getTokenBalance(newWalletAddress);
            expect(bal).to.equal(1);
        });
    });
    describe("getVsysAccountInfo function", () => {
        it("get vsys account, seed and wallet", async () => {
            const [acnt, seed, wallet] = library.getVsysAccountInfo(newSeed);
            var addr = new jv.Addr(acnt.addr.data);
            addr.validate();
            seed.validate();
        });
    });
    describe("getWalletAddress function", () => {
        it("send token and get token balance", async () => {
            const address = library.getWalletAddress(newSeed);
            var addr = new jv.Addr(address);
            addr.validate();
        });
    });
    describe("getVsysBalance function", () => {
        it("get vsys balance", async () => {
            const bal = await library.getVsysBalance(newSeed);
            expect(bal).to.equal(13);
        });
    });
    describe("getKeyPair function", () => {
        it("get private key and public key", async () => {
            const [pri, pub] = library.getKeyPair(newSeed);
            const signature = utils.sign(pri, Buffer.from("msg", "utf-8"));
            const isValid = utils.verify(pub, Buffer.from("msg", "utf-8"), signature);
            expect(isValid).to.equal(true);
        });
    });
    describe("getSignature & verifySignature function", () => {
        it("get signature and verify signature", async () => {
            const sign = library.getSignature("test", newSeed,);
            const isValid = library.verifySignature("test", sign, newSeed);
            expect(isValid).to.equal(true);
        });
    });
    describe("calculateAgreement function", () => {
        it("calculate agreement", async () => {
            const [pri, pub] = library.getKeyPair(newSeed);
            const signFromNewSeed = library.calculateAgreement(library.poolAcnt.keyPair.pub.data, newSeed);
            const signFromPoolSeed = library.calculateAgreement(jv.B58Str.fromBytes(pub).data, library.poolWalletSeed);
            expect(signFromNewSeed).to.equal(signFromPoolSeed);
        });
    });
});
