const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const TokenModule = buildModule("TokenModule", (m) => {
  // const usdt = m.contract("USDTToken");
  // const blochToken = m.contract("BlochToken");
  // const usdq = m.contract("USDQToken");

  // return { usdt, blochToken,usdq };

  const BlochToken ="0xEF61773365fB415619a7D728243FB93BEb9f4523" ;
  const USDTToken ="0x004AdEd0C533E430007fCDbC3C6454281f90c50a" ; 
  const USDQToken ="0xDA7af5998dEa1b6AcBCE79784204a3461680D5Bd" ;
  const address ="0xdc2436650c1Ab0767aB0eDc1267a219F54cf7147";
  const BlochPool = m.contract("BLOCHPool", [BlochToken, USDTToken,USDQToken,address]);

  return { BlochPool };
});

module.exports = TokenModule

