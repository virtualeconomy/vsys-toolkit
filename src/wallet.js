import dotenv from "dotenv";
import * as jv from "@virtualeconomy/js-vsys";

dotenv.config();

export class VsysLib {
    constructor(vsysHost, chain, tokCtrtId, sleepTime, poolWalletSeed) {
        this.api = jv.NodeAPI.new(vsysHost);
        this.chain = new jv.Chain(this.api, chain == "MAIN_NET" ? jv.ChainID.MAIN_NET: jv.ChainID.TEST_NET);
        this.tc = new jv.TokCtrtWithoutSplit(tokCtrtId, this.chain);
        this.sleepTime = sleepTime;
        this.poolWalletSeed = poolWalletSeed;
        this.poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
        this.poolAcnt = this.poolWallet.getAcnt(this.chain, 0);
        this.poolWalletAddress = this.poolAcnt.addr.data;
    }
    async sleep() {
        return new Promise((resolve) => setTimeout(resolve, this.sleepTime));
    } 
    async waitForConfirm (txId) {
        let info;
        console.log(`Awaiting confirmation for txn ${txId}`);
        await this.sleep();
        for (let count = 0; count < 3; count++) {
            info = await this.api.tx.getInfo(txId);
            if (info.details == "Transaction is not in blockchain") {
                await this.sleep();
            } else return info;
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
            const poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
            const poolAcnt = poolWallet.getAcnt(this.chain, 0);
            const poolBal = await poolAcnt.getBal();
            if (poolBal.data < amountWithDecimal) {
                throw new Error("Insufficient vsys balance in pool!");
            }
            var txn = await poolAcnt.pay(walletAddress, amount);

            const txnInfo = await this.waitForConfirm(txn.id);
            if(txnInfo.status != "Success") {
                console.log(`get vsys from pool failed, error: ${txnInfo.status}`);
                throw new Error(`get vsys from pool failed, error: ${txnInfo.status}`);
            }
        }
    };
    getAcntFromSeed(seed, acnt_index = 0){
        const wallet = jv.Wallet.fromSeedStr(seed);
        const acnt = wallet.getAcnt(this.chain, acnt_index);
        return acnt;
    }
    async sendToken(senderSeed, amt, receiverAddr = "", tokCtrtId = "") {
        if (!receiverAddr) {
            const poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
            const poolAcnt = poolWallet.getAcnt(this.chain, 0);
            receiverAddr = poolAcnt.addr.data
        }
        var tokCtrt;
        if(tokCtrtId != "") {
            tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrtId, this.chain);
        }
        else {
            tokCtrt = this.tc;
        }

        const seed = new jv.Seed(senderSeed);
        const wal = new jv.Wallet(seed);
        const acnt0 = wal.getAcnt(this.chain, 0);
        await this.getVsysFromPool(acnt0.addr.data);
        let resp = await tokCtrt.send(acnt0, receiverAddr, amt);
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
            tokCtrt = this.tc;
        }
        const tokBal = await tokCtrt.getTokBal(walletAddress);
        return tokBal.amount;
    };
    async getVsysBalanceFromSeed (seed = this.poolWalletSeed, acntIndex = 0) {
        const wallet = jv.Wallet.fromSeedStr(seed);
        const acnt = wallet.getAcnt(this.chain, acntIndex);
        const balance = await acnt.getBal();
        return balance.data;
    };
}
