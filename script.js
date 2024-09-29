const contractSource = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.0;

    import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
    import "@openzeppelin/contracts/utils/math/SafeMath.sol";

    contract ScissorTaxToken is ERC20 {
        using SafeMath for uint256;

        uint256 public scissorTaxPercentage;
        address public owner;
        string public website;
        string public socialMedia;

        constructor(string memory name, string memory symbol, uint256 initialSupply, uint256 _scissorTaxPercentage, string memory _website, string memory _socialMedia) ERC20(name, symbol) {
            require(_scissorTaxPercentage <= 100, "Tax percentage must be between 0 and 100");
            _mint(msg.sender, initialSupply * 10**decimals());
            scissorTaxPercentage = _scissorTaxPercentage;
            owner = msg.sender;
            website = _website;
            socialMedia = _socialMedia;
        }

        function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
            uint256 tax = amount.mul(scissorTaxPercentage).div(100);
            uint256 amountAfterTax = amount.sub(tax);
            _burn(_msgSender(), tax);
            return super.transfer(recipient, amountAfterTax);
        }

        function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
            uint256 tax = amount.mul(scissorTaxPercentage).div(100);
            uint256 amountAfterTax = amount.sub(tax);
            _burn(sender, tax);
            return super.transferFrom(sender, recipient, amountAfterTax);
        }
    }
`;

let provider;
let signer;

async function compileSolidity(source) {
    return new Promise((resolve, reject) => {
        if (typeof solc === 'undefined') {
            reject(new Error('solc 库未能正确加载，请刷新页面重试'));
            return;
        }

        const input = {
            language: 'Solidity',
            sources: {
                'token.sol': {
                    content: source
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['*']
                    }
                }
            }
        };

        try {
            const output = JSON.parse(solc.compile(JSON.stringify(input)));
            
            if (output.errors) {
                const errors = output.errors.filter(error => error.severity === 'error');
                if (errors.length > 0) {
                    reject(new Error(errors.map(error => error.formattedMessage).join('\n')));
                    return;
                }
            }

            const contractName = 'ScissorTaxToken';
            const compiledContract = output.contracts['token.sol'][contractName];
            resolve({
                abi: compiledContract.abi,
                bytecode: compiledContract.evm.bytecode.object
            });
        } catch (error) {
            reject(new Error(`编译合约时发生错误: ${error.message}`));
        }
    });
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            updateNetworkInfo();
            document.getElementById('connectWallet').textContent = '已连接钱包';
        } catch (error) {
            console.error('连接钱包失败:', error);
        }
    } else {
        console.log('请安装 MetaMask!');
    }
}

async function updateNetworkInfo() {
    const network = await provider.getNetwork();
    const address = await signer.getAddress();
    document.getElementById('networkInfo').innerHTML = `
        <p>当前网络: ${getNetworkName(network.chainId)}</p>
        <p>当前地址: ${address}</p>
    `;
}

function getNetworkName(chainId) {
    switch(chainId) {
        case 1: return 'Ethereum 主网';
        case 3: return 'Ropsten 测试网';
        case 4: return 'Rinkeby 测试网';
        case 5: return 'Goerli 测试网';
        case 42: return 'Kovan 测试网';
        default: return '未知网络';
    }
}

async function deployContract(name, symbol, totalSupply, scissorTaxPercent, website, socialMedia) {
    try {
        const { abi, bytecode } = await compileSolidity(contractSource);
        const factory = new ethers.ContractFactory(abi, bytecode, signer);
        const contract = await factory.deploy(name, symbol, totalSupply, scissorTaxPercent, website, socialMedia);
        await contract.deployed();
        
        const network = await provider.getNetwork();
        const explorerUrl = getExplorerUrl(network.chainId, contract.address);
        
        const contractInfo = {
            address: contract.address,
            name: name,
            symbol: symbol,
            network: getNetworkName(network.chainId),
            explorerUrl: explorerUrl
        };
        
        saveContractInfo(contractInfo);
        updateContractList();

        document.getElementById('result').innerHTML = `
            <p>合约已部署成功!</p>
            <p>合约地址: <a href="${explorerUrl}" target="_blank">${contract.address}</a></p>
        `;
    } catch (error) {
        console.error('部署合约失败:', error);
        document.getElementById('result').innerHTML = `<p class="error">部署失败: ${error.message}</p>`;
    }
}

function getExplorerUrl(chainId, address) {
    switch(chainId) {
        case 1: return `https://etherscan.io/address/${address}`;
        case 3: return `https://ropsten.etherscan.io/address/${address}`;
        case 4: return `https://rinkeby.etherscan.io/address/${address}`;
        case 5: return `https://goerli.etherscan.io/address/${address}`;
        case 42: return `https://kovan.etherscan.io/address/${address}`;
        default: return '#';
    }
}

function saveContractInfo(contractInfo) {
    let contracts = JSON.parse(localStorage.getItem('deployedContracts') || '[]');
    contracts.push(contractInfo);
    localStorage.setItem('deployedContracts', JSON.stringify(contracts));
}

function updateContractList() {
    const contracts = JSON.parse(localStorage.getItem('deployedContracts') || '[]');
    const contractList = document.getElementById('contractList');
    contractList.innerHTML = '';
    contracts.forEach((contract, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <p>${contract.name} (${contract.symbol})</p>
            <p>地址: <a href="${contract.explorerUrl}" target="_blank">${contract.address}</a></p>
            <p>网络: ${contract.network}</p>
            <button onclick="removeContract(${index})">删除</button>
        `;
        contractList.appendChild(li);
    });
}

function removeContract(index) {
    let contracts = JSON.parse(localStorage.getItem('deployedContracts') || '[]');
    contracts.splice(index, 1);
    localStorage.setItem('deployedContracts', JSON.stringify(contracts));
    updateContractList();
}

document.getElementById('connectWallet').addEventListener('click', connectWallet);

document.getElementById('tokenForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const symbol = document.getElementById('symbol').value;
    const totalSupply = document.getElementById('supply').value;
    const scissorTaxPercent = document.getElementById('tax').value;
    const website = document.getElementById('website').value;
    const socialMedia = document.getElementById('social').value;

    await deployContract(name, symbol, totalSupply, scissorTaxPercent, website, socialMedia);
});

// 页面加载时更新合约列表
window.addEventListener('load', function() {
    updateContractList();
});
