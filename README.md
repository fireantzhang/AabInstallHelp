# AabInstallHelp

### 用途：

该项目主要是一个简单的安卓平台的 `aab` 安装包辅助安装软件，软件内置了 `bundletool` 工具和 `adb` 程序包，可以直接简单的选择一个目标安装包，即可自动完成安装流程，主要为了方便非研发人员安装 `aab` 格式的安装包。

大致的安装示意情况如下：

![image](image/aab_install_soft.gif)



项目是使用 [Electron](https://www.electronjs.org/) 进行开发（特点是：使用 js，html 和 css 构建跨平台的桌面应用），目前该工具支持输出 mac 和 window 平台的安装包。

### 构建流程
1. 确认本地有 node 和 npm 环境，如果没有需要先配置：[配置方式](https://nodejs.org/en/download/)

```
~ » node -v
v13.4.0

~ » npm -v
6.14.4
```

2. 如果本地已有 node 和 npm 环境，代码 clone 到本地之后，进入到项目根目录，执行以下命令即可运行

```
// 1、初始化项目
~ » npm install

// 2、mac 平台运行方式
~ » npm run start 

// 3、window 平台运行方式
~ » npm run start_win

// 初次构建，两个命令也可以一起运行，比如 mac
~ » npm install && npm run start
```

### 打包方式（会在根目录的 `release` 文件夹下）
1. mac 平台
```
npm run elebuild_mac
```

2. window 平台
```
npm run elebuild_win
```

### 自定义操作说明

由于为了简单方便，直接把签名文件和签名信息内置在了软件中，所以签名文件和信息都是公开的，会出现安装的 应用签名并非你自己公司业务的应用。



所以如果需要符合自身公司的业务，可以直接修改源码，然后再打包符合自己公司业务的工具软件，然后给到相关的测试同事使用，主要的代码逻辑在 `main.js` 这个文件中：

```
// aab 文件信息类
class AabInfo {
  constructor(pkg_v, vname_v, vcode_v) {
    this.pkg = pkg_v;
    this.vname = vname_v;
    this.vcode = vcode_v;
  }

  getAppVersionInfo() {
    return `${this.vname}.${this.vcode}`;
  }

  /**
   * 获取签名文件名，放在 assets 目录下
   */
  getKeystoreName() {
    // 可以针对不同应用使用不同的签名文件
    if (this.pkg == 'com.fireantzhang.aabdemo') {
      return 'release.jks';
    }
    return 'release.jks'
  }

  /**
   * 获取签名配置信息
   */
  getKeystoreConfig() {
    if (this.pkg == 'com.fireantzhang.aabdemo') {
      return new KeystoreConfig('fireantzhang', 'fireantzhang', 'fireantzhang');
    }
    return new KeystoreConfig('fireantzhang', 'fireantzhang', 'fireantzhang');
  }

  /**
   * 获取启动的 activity，TODO：调整成直接从清单文件中读取，不过逻辑有点复杂，暂时未实现
   */
  getAutoStartActivity() {
    if (this.pkg == 'com.fireantzhang.aabdemo') {
      return 'com.fireantzhang.aabdemo/com.fireantzhang.aabdemo.MainActivity';
    }

    return null;
  }
}

// 签名节本信息类
class KeystoreConfig {
  constructor(ks_pass_v, alias_v, key_pass_v) {
    this.ks_pass = ks_pass_v;
    this.alias = alias_v;
    this.key_pass = key_pass_v;
  }
}
```

