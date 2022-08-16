const sdk = require("@defillama/sdk");

const readerAbi = require("./reader.json");
const mvlpManagerAbi = require("./mvlpManager.json");
const { BigNumber } = require("ethers");

const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MVLP_ADDRESS = "0x9F4f8bc00F48663B7C204c96b932C29ccc43A2E8";
const MVLP_DECIMALS = 18;

const REDEEM_CONTRACT = "0xd15C4677A81Ac9d744a01ecaAad684E6d296b8f3";
const GOV_CLUB_CONTRACT = "0x12fc8b560925166c39E85c70E9fD4058Ca9e11c9";

const MVD_DAO_MULTI_SIG_WALLET = "0x4876e4303dad975effe107ba84598ce4a24724ed";
const MVLP_TRACKER_CONTRACT = "0xA6ca41Bbf555074ed4d041c1F4551eF48116D59A";

const MVLP_MANAGER_CONTRACT = "0x13E733dDD6725a8133bec31b2Fc5994FA5c26Ea9"; // getAums
const READER_CONTRACT = "0x01dd8B434A83cbdDFa24f2ef1fe2D6920ca03734"; // getTokenBalancesWithSupplies --> ( [3] => get these value )

const stakingAddress = "0x42162457006DB4DA3a7af5B53DFee5A891243b4D"; // Governance Staking
const stakingTokenAddress = "0x788B6D2B37Aa51D916F2837Ae25b05f0e61339d1"; // MVD
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

async function getStaking(timestamp, ethBlock, chainBlocks) {
  const mvdPrice = BigNumber.from(272); // $2.72

  // MVD balance of Staking contract
  const mvdBalance = (
    await sdk.api.erc20.balanceOf({
      block: ethBlock,
      target: stakingTokenAddress,
      owner: stakingAddress,
    })
  ).output;

  const bal = BigNumber.from(mvdBalance)
    .mul(mvdPrice)
    .div(BigNumber.from(10).pow(5));

  return {
    [USDC_ADDRESS]: bal.toString(),
  };
}

async function getTvl(timestamp, ethBlock, chainBlocks) {
  // DAI balance of Redeem contract
  const daiBalance = (
    await sdk.api.erc20.balanceOf({
      block: ethBlock,
      target: DAI_ADDRESS,
      owner: REDEEM_CONTRACT,
    })
  ).output;

  // USDC balance of Gov Club contract
  const usdcBalance = (
    await sdk.api.erc20.balanceOf({
      block: ethBlock,
      target: USDC_ADDRESS,
      owner: GOV_CLUB_CONTRACT,
    })
  ).output;

  // Metavault DAO MVLP Holdings
  const aums = (
    await sdk.api.abi.call({
      target: MVLP_MANAGER_CONTRACT,
      abi: mvlpManagerAbi.getAums,
      chain: "polygon",
      block: ethBlock,
    })
  ).output;

  const averageAums = BigNumber.from(aums[0])
    .add(BigNumber.from(aums[1]))
    .div(2);

  const supplies = (
    await sdk.api.abi.call({
      target: READER_CONTRACT,
      params: [ADDRESS_ZERO, [MVLP_ADDRESS]],
      chain: "polygon",
      abi: readerAbi.getTokenBalancesWithSupplies,
      block: ethBlock,
    })
  ).output;

  const mvlpSupply = BigNumber.from(supplies[1]);

  const mvlpPrice = averageAums
    .mul(BigNumber.from(10).pow(MVLP_DECIMALS))
    .div(mvlpSupply)
    .div(BigNumber.from(10).pow(MVLP_DECIMALS));

  const metavaultDaoMvlpHoldings = (
    await sdk.api.erc20.balanceOf({
      block: ethBlock,
      chain: "polygon",
      target: MVLP_TRACKER_CONTRACT,
      owner: MVD_DAO_MULTI_SIG_WALLET,
    })
  ).output;

  const daoMvlpHoldingsValue = BigNumber.from(metavaultDaoMvlpHoldings).mul(
    mvlpPrice
  );

  const sum = BigNumber.from(daiBalance)
    .div(BigNumber.from(10).pow(12))
    .add(BigNumber.from(usdcBalance))
    .add(BigNumber.from(daoMvlpHoldingsValue).div(BigNumber.from(10).pow(24)));

  return {
    [USDC_ADDRESS]: sum.toString(),
  };
}

module.exports = {
  ethereum: {
    tvl: getTvl,
    staking: getStaking,
  },
};
