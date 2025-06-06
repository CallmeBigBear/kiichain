const {setupSigners, deployErc721PointerForCw721, getAdmin, deployWasm,  executeWasm, ABI, registerPointerForERC20,
    registerPointerForERC721
} = require("./lib");
const {expect} = require("chai");

const CW721_BASE_WASM_LOCATION = "../contracts/wasm/cw721_base.wasm";

describe("ERC721 to CW721 Pointer", function () {
    let accounts;
    let pointerAcc0;
    let pointerAcc1;
    let cw721Address;
    let admin;

    before(async function () {
        accounts = await setupSigners(await hre.ethers.getSigners())
        admin = await getAdmin()

        cw721Address = await deployWasm(CW721_BASE_WASM_LOCATION, admin.kiiAddress, "cw721", {
            name: "Test",
            symbol: "TEST",
            minter: admin.kiiAddress
        })

        await executeWasm(cw721Address,  { mint : { token_id : "1", owner : admin.kiiAddress, token_uri: "token uri 1"}});
        await executeWasm(cw721Address,  { mint : { token_id : "2", owner : accounts[0].kiiAddress, token_uri: "token uri 2"}});
        await executeWasm(cw721Address,  { mint : { token_id : "3", owner : accounts[1].kiiAddress, token_uri: "token uri 3"}});

        const pointerAddr = await deployErc721PointerForCw721(hre.ethers.provider, cw721Address)
        const contract = new hre.ethers.Contract(pointerAddr, ABI.ERC721, hre.ethers.provider);
        pointerAcc0 = contract.connect(accounts[0].signer)
        pointerAcc1 = contract.connect(accounts[1].signer) 
    })

    describe("validation", function(){
        it("should not allow a pointer to the pointer", async function(){
            try {
                await registerPointerForERC721(await pointerAcc0.getAddress())
                expect.fail(`Expected to be prevented from creating a pointer`);
            } catch(e){
                expect(e.message).to.include("contract deployment failed");
            }
        })
    })

    describe("read", function(){
        it("get name", async function () {
            const name = await pointerAcc0.name();
            expect(name).to.equal("Test");
        });

        it("get symbol", async function () {
            const symbol = await pointerAcc0.symbol();
            expect(symbol).to.equal("TEST");
        });

        it("owner of", async function () {
            const owner = await pointerAcc0.ownerOf(1);
            expect(owner).to.equal(admin.evmAddress);
        });

        it("token uri", async function () {
            const uri = await pointerAcc0.tokenURI(1);
            expect(uri).to.equal("token uri 1");
        });

        it("balance of", async function () {
            const balance = await pointerAcc0.balanceOf(admin.evmAddress);
            expect(balance).to.equal(1);
        });

        it("get approved", async function () {
            const approved = await pointerAcc0.getApproved(1);
            expect(approved).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("is approved for all", async function () {
            const approved = await pointerAcc0.isApprovedForAll(admin.evmAddress, admin.evmAddress);
            expect(approved).to.equal(false);
        });
    })

    describe("write", function(){
        it("approve", async function () {
            const blockNumber = await ethers.provider.getBlockNumber();
            const approvedTxResp = await pointerAcc0.approve(accounts[1].evmAddress, 2)
            await approvedTxResp.wait()
            const approved = await pointerAcc0.getApproved(2); 
            expect(approved).to.equal(accounts[1].evmAddress);

            const filter = {
                fromBlock: '0x' + blockNumber.toString(16),
                toBlock: 'latest',
                address: await pointerAcc1.getAddress(),
                topics: [ethers.id("Approval(address,address,uint256)")]
            };
            // send via eth_ endpoint - synthetic event should show up because we are using the
            // synthetic event in place of a real EVM event
            const ethlogs = await ethers.provider.send('eth_getLogs', [filter]);
            // expect(ethlogs.length).to.equal(1); // TODO: Investigate and align with the fork

            // send via kii_ endpoint - synthetic event shows up
            const kiilogs = await ethers.provider.send('kii_getLogs', [filter]);
            expect(kiilogs.length).to.equal(1);

            const logs = [...ethlogs, ...kiilogs];
            logs.forEach(async (log) => {
                expect(log["address"].toLowerCase()).to.equal((await pointer.getAddress()).toLowerCase());
                expect(log["topics"][0]).to.equal(ethers.id("Transfer(address,address,uint256)"));
                expect(log["topics"][1].substring(26)).to.equal(accounts[0].evmAddress.substring(2).toLowerCase());
                expect(log["topics"][2].substring(26)).to.equal(accounts[1].evmAddress.substring(2).toLowerCase());
            });
        });

        it("cannot approve token you don't own", async function () {
            await expect(pointerAcc0.approve(accounts[1].evmAddress, 1)).to.be.reverted;
        });

        it("transfer from", async function () {
            // accounts[0] should transfer token id 2 to accounts[1]
            await mine(pointerAcc0.approve(accounts[1].evmAddress, 2));
            const blockNumber = await ethers.provider.getBlockNumber();
            transferTxResp = await pointerAcc1.transferFrom(accounts[0].evmAddress, accounts[1].evmAddress, 2);
            const receipt = await transferTxResp.wait();
            const filter = {
                fromBlock: '0x' + blockNumber.toString(16),
                toBlock: 'latest',
                address: await pointerAcc1.getAddress(),
                topics: [ethers.id("Transfer(address,address,uint256)")]
            };
            // send via eth_ endpoint - synthetic event doesn't show up
            const ethlogs = await ethers.provider.send('eth_getLogs', [filter]);
            // expect(ethlogs.length).to.equal(0); // TODO: Investigate and align with the fork
            const kiilogs = await ethers.provider.send('kii_getLogs', [filter]);
            expect(kiilogs.length).to.equal(1);
            const logs = [...ethlogs, ...kiilogs];
            logs.forEach(async (log) => {
                expect(log["address"].toLowerCase()).to.equal((await pointerAcc1.getAddress()).toLowerCase());
                expect(log["topics"][0]).to.equal(ethers.id("Transfer(address,address,uint256)"));
                expect(log["topics"][1].substring(26)).to.equal(accounts[1].evmAddress.substring(2).toLowerCase());
                expect(log["topics"][2].substring(26)).to.equal(accounts[1].evmAddress.substring(2).toLowerCase());
            });

            const balance0 = await pointerAcc0.balanceOf(accounts[0].evmAddress);
            expect(balance0).to.equal(0);
            const balance1 = await pointerAcc0.balanceOf(accounts[1].evmAddress);
            expect(balance1).to.equal(2);

            // do same for eth_getBlockReceipts and kii_getBlockReceipts
            const ethBlockReceipts = await ethers.provider.send('eth_getBlockReceipts', ['0x' + blockNumber.toString(16)]);
            // expect(ethBlockReceipts.length).to.equal(1); // TODO: Investigate and align with the fork
            const kiiBlockReceipts = await ethers.provider.send('kii_getBlockReceipts', ['0x' + blockNumber.toString(16)]);
            expect(kiiBlockReceipts.length).to.equal(1);

            const ethTx = await ethers.provider.send('eth_getTransactionReceipt', [receipt.hash]);
            expect(ethTx.logs.length).to.equal(1);
            const ethTxByHash = await ethers.provider.send('eth_getTransactionByHash', [receipt.hash]);
            expect(ethTxByHash).to.not.be.null;

            // return token id 2 back to accounts[0] using safe transfer from
            await mine(pointerAcc1.approve(accounts[0].evmAddress, 2));
            await mine(pointerAcc1.safeTransferFrom(accounts[1].evmAddress, accounts[0].evmAddress, 2));
            const balance0After = await pointerAcc0.balanceOf(accounts[0].evmAddress);
            expect(balance0After).to.equal(1);
        });

        it("cannot transfer token you don't own", async function () {
            await expect(pointerAcc0.transferFrom(accounts[0].evmAddress, accounts[1].evmAddress, 3)).to.be.reverted;
        });

        it("set approval for all", async function () {
            const setApprovalForAllTxResp = await pointerAcc0.setApprovalForAll(accounts[1].evmAddress, true);
            await setApprovalForAllTxResp.wait();
            await expect(setApprovalForAllTxResp)
                .to.emit(pointerAcc0, 'ApprovalForAll')
                .withArgs(accounts[0].evmAddress, accounts[1].evmAddress, true);
            const approved = await pointerAcc0.isApprovedForAll(accounts[0].evmAddress, accounts[1].evmAddress);
            expect(approved).to.equal(true);

            // test revoking approval
            await mine(pointerAcc0.setApprovalForAll(accounts[1].evmAddress, false));
            const approvedAfter = await pointerAcc0.isApprovedForAll(accounts[0].evmAddress, accounts[1].evmAddress);
            expect(approvedAfter).to.equal(false);
        });
    })
})

async function mine(action) {
    await (await action).wait()
}
