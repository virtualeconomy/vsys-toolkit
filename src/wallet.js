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
      }
    async sleep() {
        return new Promise((resolve) => setTimeout(resolve, this.sleepTime));
    } 
    async waitForConfirm (txId) {
        let info;
        await this.sleep();
        for (let count = 0; count < 3; count++) {
            info = await this.api.tx.getInfo(txId);
            if (info.details == "Transaction is not in blockchain") {
                await this.sleep();
            } else return info;
            console.log("info", info);
        }
        return null;
    };
    createNewWal() {
        const wal = jv.Wallet.register();
        return [wal.seed.data, wal.getAcnt(this.chain, 0).addr.data];
    };
    async getVsysFromPool(walletAddress) {
        const vsysBal = await this.api.addr.getBalance(walletAddress);
        if (vsysBal.balance < 1) {
            const poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
            const poolAcnt = poolWallet.getAcnt(this.chain, 0);
            const poolBal = await poolAcnt.getBal();
            console.log(poolBal.data);
            if (poolBal.data < 6) {
                throw new Error("Insufficient vsys balance in pool!");
            }
            await poolAcnt.pay(walletAddress, 6);
            await this.sleep();
        }
    };
    async sendToken(senderSeed, amt, receiverAddr = "") {
        if (!receiverAddr) {
            const poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
            const poolAcnt = poolWallet.getAcnt(this.chain, 0);
            receiverAddr = poolAcnt.addr.data
        }

        const seed = new jv.Seed(senderSeed);
        const wal = new jv.Wallet(seed);
        const acnt0 = wal.getAcnt(this.chain, 0);
        await this.getVsysFromPool(acnt0.addr.data);
        let resp = await this.tc.send(acnt0, receiverAddr, amt);
        if (resp.hasOwnProperty("error")) {
            console.error(`Send token failed: error: ${resp.error}, message: ${resp.message}`);
            throw new Error(`Send token failed: error: ${resp.error}, message: ${resp.message}`);
        }
        console.log(resp);
        console.log(`Send token txn id: ${resp.id}`);
        return await this.waitForConfirm(resp.id);
    };
    async getTokenBalance (walletAddress) {
        const tokBal = await this.tc.getTokBal(walletAddress);
        return tokBal.amount;
    };
}
