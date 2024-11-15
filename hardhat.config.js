require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();


// const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
// console.log("PRIVATE_KEY:", PRIVATE_KEY);
module.exports = {
  paths: {
    sources: "./contracts", // Thư mục chứa các tệp hợp đồng
    tests: "./test", // Thư mục chứa các tệp kiểm thử
    cache: "./cache", // Thư mục chứa cache biên dịch
    artifacts: "./artifacts" // Thư mục chứa các tệp ABI và bytecode đã biên dịch
  },
  solidity: {
    version: "0.8.20", // Phiên bản Solidity sẽ được sử dụng
    settings: {
      optimizer: {
        enabled: true, // Bật trình tối ưu hóa
        runs: 200 // Số lần chạy tối ưu hóa
      }
    }
  },
  networks: {
    testchain: {
      url: "https://sepolia.infura.io/v3/082f3c154c4d4ccdbd305e854d654836", // URL của nút RPC mạng Sepolia
      accounts: [process.env.PRIVATE_KEY], // Khóa riêng của tài khoản để ký giao dịch
      chainId: 11155111, // Chain ID của mạng Sepolia
     
    }
  },
  etherscan: {
    apiKey: process.env.API_KEY // Khóa API của Etherscan để tải lên hợp đồng
  },
  sourcify: {
   enabled: true
  }
};