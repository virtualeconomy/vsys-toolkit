import dotenv from "dotenv";
import * as jv from "@virtualeconomy/js-vsys";
import Axlsign from 'axlsign';

dotenv.config();

export class VsysLib {
    constructor(vsysHost, chain, tokCtrtId, sleepTime, poolWalletSeed, poolWalletIndex = 0) {
        this.api = jv.NodeAPI.new(vsysHost);
        this.chain = new jv.Chain(this.api, chain == "MAIN_NET" ? jv.ChainID.MAIN_NET: jv.ChainID.TEST_NET);
        this.tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrtId, this.chain);
        this.sleepTime = sleepTime;
        this.poolWalletSeed = poolWalletSeed;
        this.poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
        this.poolAcnt = this.poolWallet.getAcnt(this.chain, poolWalletIndex);
        this.poolWalletAddress = this.poolAcnt.addr.data;
    }
    getVsysAccountInfo (seedPhrase, index = 0) {
        const seed  = new jv.Seed(seedPhrase);
        const wal   = new jv.Wallet(seed);
        const acnt  = wal.getAcnt(this.chain, index);
        return [acnt, seed, wal]
    }
    getWalletAddress(seedPhrase, index = 0) {
        const [acnt, seed, wallet] = this.getVsysAccountInfo(seedPhrase, index);
        return acnt.addr.data;
    }
    async getVsysBalance(seedPhrase = this.poolWalletSeed, index = 0) {
        const [acnt, seed, wallet] = this.getVsysAccountInfo(seedPhrase, index);
        const bal = await acnt.getBal();
        return bal.data / jv.VSYS.UNIT;
    }
    getKeyPair(seedPhrase, index = 0) {
        const [acnt, seed, wallet] = this.getVsysAccountInfo(seedPhrase, index);
        return [acnt.keyPair.pri.bytes, acnt.keyPair.pub.bytes];
    }
    getSignature(seedPhrase, msg, index = 0) {
        const [pri, pub] = this.getKeyPair(seedPhrase, index);
        const signature = Axlsign.sign(pri, Buffer.from(msg, "utf-8"));
        return jv.B58Str.fromBytes(signature).data;
    }
    verifySignature(seedPhrase, msg, signature, index = 0) {
        const [pri, pub] = this.getKeyPair(seedPhrase, index);
        const isValid = Axlsign.verify(pub, Buffer.from(msg, "utf-8"), jv.Bytes.fromB58Str(signature).data);
        return isValid;
    }
    async sleep() {
        return new Promise((resolve) => setTimeout(resolve, this.sleepTime));
    } 
    async waitForConfirm (txId) {
        let info;
        console.log(`Awaiting confirmation for txn ${txId}`);
        for (let count = 0; count < 3; count++) {
            await this.sleep();
            info = await this.api.tx.getInfo(txId);
            if (info.details != "Transaction is not in blockchain") {
                return info;
            }
        }
        console.log(`Txn ${txId} is not in the blockchain`);
        throw new Error(`Txn ${txId} is not in the blockchain`);
    };
    createNewWal() { 
        const wal = jv.Wallet.register();
        return [wal.seed.data, wal.getAcnt(this.chain, 0).addr.data];
    };
    async getVsysFromPool(walletAddress, amount = 6) {
        const amountWithDecimal = amount * 100000000;
        const vsysBal = await this.api.addr.getBalance(walletAddress);
        if (vsysBal.balance < amountWithDecimal) {
            const poolBal = await this.poolAcnt.getBal();

            if (poolBal.data < amountWithDecimal) {
                throw new Error("Insufficient vsys balance in pool!");
            }
            var txn = await this.poolAcnt.pay(walletAddress, amount);
            if (txn.hasOwnProperty("error")) {
                console.error(`Send token failed: error: ${resp.error}, message: ${txn.message}`);
                throw new Error(`Send token failed: error: ${resp.error}, message: ${txn.message}`);
            }
            const txnInfo = await this.waitForConfirm(txn.id);

            if(txnInfo.status != "Success") {
                console.log(`get vsys from pool failed, error: ${txnInfo.status}`);
                throw new Error(`get vsys from pool failed, error: ${txnInfo.status}`);
            }
        }
    };
    async sendToken(seedPhrase, amt, receiverAddr = "", tokCtrtId = "", index = 0) {
        if (receiverAddr == "") {
            receiverAddr = this.poolWalletAddress;
        }
        var tokCtrt;
        if(tokCtrtId == "") {
            tokCtrt = this.tokCtrt;
        }
        else {
            tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrtId, this.chain);
        }
        const [acnt, seed, wal] = this.getVsysAccountInfo(seedPhrase, index);
        await this.getVsysFromPool(acnt.addr.data);
        let resp = await tokCtrt.send(acnt, receiverAddr, amt);
        if (resp.hasOwnProperty("error")) {
            console.error(`Send token failed: error: ${resp.error}, message: ${resp.message}`);
            throw new Error(`Send token failed: error: ${resp.error}, message: ${resp.message}`);
        }
        const txnInfo = await this.waitForConfirm(resp.id);
        if(txnInfo.status != "Success") {
            console.log(`send token failed, error: ${txnInfo.status}`);
            throw new Error(`send token failed, error: ${txnInfo.status}`)
        }
        return txnInfo;
    };
    async getTokenBalance (walletAddress, tokCtrtId = "") {
        var tokCtrt;
        if(tokCtrtId != "") {
            tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrtId, this.chain);
        }
        else {
            tokCtrt = this.tokCtrt;
        }
        const tokBal = await tokCtrt.getTokBal(walletAddress);
        return tokBal.amount;
    };
    calculateAgreement(theirPubKey, seedPhrase = this.poolWalletSeed, index = 0) {
        const [pri, pub] = this.getKeyPair(seedPhrase, index);
        var agreement =  Axlsign.sharedKey(pri, jv.Bytes.fromB58Str(theirPubKey).data);
        var result = Buffer.from(agreement);
        return jv.B58Str.fromBytes(result).data;
    }
}
