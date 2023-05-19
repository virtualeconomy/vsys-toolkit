import dotenv from "dotenv";
import * as jv from "@virtualeconomy/js-vsys";
import Axlsign from 'axlsign';

dotenv.config();
export class VsysLibBase {
    /**
     * Create a new Model instance.
     * @param {string} vsysHost - Vsystems host api
     * @param {string} chain - MAIN_NET or TEST_NET 
     * @param {number} sleepTime - Awaiting block time
    */
    constructor(vsysHost, chain, sleepTime) {
        this.api = jv.NodeAPI.new(vsysHost);
        this.chain = new jv.Chain(this.api, chain == "MAIN_NET" ? jv.ChainID.MAIN_NET: jv.ChainID.TEST_NET);
        this.sleepTime = sleepTime;
    }
    /**
     * Awaits 
     * @param {number} sleepTime - Awaiting time in millisecond (ms)
     * @returns {Promise} Wait for a certain period of time
    */
    async sleep(sleepTime = this.sleepTime) {
        return new Promise((resolve) => setTimeout(resolve, sleepTime));
    } 
    /**
     * Awaits for transaction confirmation
     * @param {string} txId - Vsystems transaction id
     * @returns {object} The response of transaction.
    */
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
    /**
     * Create new wallet
     * @returns {[string, string]} wallet seed and wallet address
    */
    createNewWal() { 
        const wal = jv.Wallet.register();
        return [wal.seed.data, wal.getAcnt(this.chain, 0).addr.data];
    };
    /**
     * Get token balance
     * @param {string} walletAddress - wallet address
     * @param {string} tokCtrt - Vsystems token contract Id. Defaults to pool token contract
     * @returns {number} balance of the token
    */
    async getTokenBalance (walletAddress, tokCtrt) {
        if(tokCtrt instanceof jv.TokCtrtWithoutSplit) {
            tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrt.ctrtId.data, this.chain);
        }
        const tokBal = await tokCtrt.getTokBal(walletAddress);
        return (tokBal.amount).toNumber();
    };
}
export class VsysLib extends VsysLibBase{
    /**
     * Create a new Model instance.
     * @param {string} vsysHost - Vsystems host api
     * @param {string} chain - MAIN_NET or TEST_NET 
     * @param {string} tokCtrtId - Token Contract ID
     * @param {number} sleepTime - Awaiting block time
     * @param {string} poolWalletSeed - Seed of pool wallet
     * @param {number} poolWalletIndex - Index of pool wallet
    */
    constructor(vsysHost, chain, tokCtrtId, sleepTime, poolWalletSeed, poolWalletIndex = 0) {
        super(vsysHost, chain, sleepTime);
        this.api = jv.NodeAPI.new(vsysHost);
        this.chain = new jv.Chain(this.api, chain == "MAIN_NET" ? jv.ChainID.MAIN_NET: jv.ChainID.TEST_NET);
        this.tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrtId, this.chain);
        this.sleepTime = sleepTime;
        this.poolWalletSeed = poolWalletSeed;
        this.poolWallet = jv.Wallet.fromSeedStr(this.poolWalletSeed);
        this.poolAcnt = this.poolWallet.getAcnt(this.chain, poolWalletIndex);
        this.poolWalletAddress = this.poolAcnt.addr.data;
    }
    /**
     * Get account, seed and wallet
     * @param {string} seedPhrase - Seed of wallet
     * @param {number} index - Index of wallet. Defaults to 0
     * @returns {[jv.Account, jv.Seed, jv.Wallet]} account, seed, wallet
    */
    getVsysAccountInfo (seedPhrase, index = 0) {
        const seed  = new jv.Seed(seedPhrase);
        const wal   = new jv.Wallet(seed);
        const acnt  = wal.getAcnt(this.chain, index);
        return [acnt, seed, wal]
    }
    /**
     * Get wallet address
     * @param {string} seedPhrase - Seed of wallet
     * @param {number} index - Index of wallet. Defaults to 0
     * @returns {string} wallet address 
    */
    getWalletAddress(seedPhrase, index = 0) {
        const [acnt, seed, wallet] = this.getVsysAccountInfo(seedPhrase, index);
        return acnt.addr.data;
    }
    /**
     * Get wallet balance
     * @param {string} seedPhrase - Seed of wallet. Defaults to pool wallet seed
     * @param {number} index - Index of wallet. Defaults to 0
     * @returns {number} Balance of wallet
    */
    async getVsysBalance(seedPhrase = this.poolWalletSeed, index = 0) {
        const [acnt, seed, wallet] = this.getVsysAccountInfo(seedPhrase, index);
        const bal = await acnt.getBal();
        return bal.data / jv.VSYS.UNIT;
    }
    /**
     * Get key pair
     * @param {string} seedPhrase - Seed of wallet. Defaults to pool wallet seed
     * @param {number} index - Index of wallet. Defaults to 0
     * @returns {[jv.PriKey, jv.PubKey]} Private key and public key
    */
    getKeyPair(seedPhrase = this.poolWalletSeed, index = 0) {
        const [acnt, seed, wallet] = this.getVsysAccountInfo(seedPhrase, index);
        return [acnt.keyPair.pri.bytes, acnt.keyPair.pub.bytes];
    }
    /**
     * Get signature
     * @param {string} msg - message to be signed
     * @param {string} seedPhrase - Seed of wallet. Defaults to pool wallet seed
     * @param {number} index - Index of wallet. Defaults to 0
     * @returns {string} signature
    */
    getSignature(msg, seedPhrase = this.poolWalletSeed, index = 0) {
        const [pri, pub] = this.getKeyPair(seedPhrase, index);
        const signature = Axlsign.sign(pri, Buffer.from(msg, "utf-8"));
        return jv.B58Str.fromBytes(signature).data;
    }
    /**
     * Get signature
     * @param {string} msg - message to be signed
     * @param {string} signature - signature of the message
     * @param {string} seedPhrase - Seed of wallet. Defaults to pool wallet seed
     * @param {number} index - Index of wallet. Defaults to 0
     * @returns {boolean} True or False
    */
    verifySignature(msg, signature, seedPhrase = this.poolWalletSeed, index = 0) {
        const [pri, pub] = this.getKeyPair(seedPhrase, index);
        const isValid = Axlsign.verify(pub, Buffer.from(msg, "utf-8"), jv.Bytes.fromB58Str(signature).data);
        return isValid;
    }
    
    /**
     * Get vsystems coin from pool
     * @param {string} walletAddress - receiver's wallet address
     * @param {number} amount - amount of coin to be transferred. Defaults to 6
    */
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
    /**
     * Send token
     * @param {number} amt - Amount to be transferred
     * @param {string} seedPhrase - Sender's wallet seed. Defaults to pool wallet seed
     * @param {string} receiverAddr - receiver's wallet address. Defaults to pool wallet address
     * @param {string} tokCtrt - Vsystems token contract Id. Defaults to pool token contract
     * @param {number} index - Index. Defaults to 0
     * @returns {object} The response of transaction.
    */
    async sendToken(amt, seedPhrase = this.poolWalletSeed, receiverAddr = this.poolWalletAddress, tokCtrt = this.tokCtrt, index = 0) {
        if(tokCtrt != this.tokCtrt) {
            tokCtrt = new jv.TokCtrtWithoutSplit(tokCtrt, this.chain);
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
    async getTokenBalance (walletAddress, tokCtrt = this.tokCtrt) {
        return super.getTokenBalance(walletAddress, tokCtrt)
    };
    
    /**
     * Get agreement
     * @param {string} theirPubKey - wallet address
     * @param {string} seedPhrase - Seed of wallet. Defaults to pool wallet seed
     * @param {number} index - Index. Defaults to 0
     * @returns {string} agreement
    */
    calculateAgreement(theirPubKey, seedPhrase = this.poolWalletSeed, index = 0) {
        const [pri, pub] = this.getKeyPair(seedPhrase, index);
        var agreement =  Axlsign.sharedKey(pri, jv.Bytes.fromB58Str(theirPubKey).data);
        var result = Buffer.from(agreement);
        return jv.B58Str.fromBytes(result).data;
    }
}
