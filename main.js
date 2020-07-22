const { app, BrowserWindow, ipcMain, ipcRenderer, dialog, nativeImage } = require('electron');
const {Menu} = require('electron');
const exec = require('child_process').exec;
const xmlReader = require('xmlreader');
const path = require('path');
const readFile = require('fs');

// 应用的主窗口
let mainWindow;

// 创建主窗口
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    title: "安装 aab 程序包",
    minHeight: 600,
    minWidth: 800,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // 主进程中使用
  // mainWindow.webContents.openDevTools();

  // 加载index.html文件
  mainWindow.loadFile("index.html");

  console.log('是否是 window 平台：' + isWinOS());
  console.log(`平台信息：` + process.platform);
  console.log('是否是开发环境：' + app.isPackaged);
  console.log(`资源路径：${process.resourcesPath}`)
}

app.on('ready', createWindow)

app.on("window-all-closed", function() {
  app.quit();
})

// 处理选择文件
ipcMain.on('open_file_select', function (event, arg) {

  var options = {
    title: '选择 aab 程序包',
    filters: [{ name: 'aab', extensions: ['aab'] }],
    properties: ['openFile']
  }

  dialog.showOpenDialog(win, options)
    .then((res) => {
      if (res.canceled) {
        return
      }
      const filenames = res.filePaths;
      console.log(`选择文件：${filenames}`);
    });
});

// 接收渲染进程发送过来的消息，可以通过：on_install_rsp 发送消息回去
ipcMain.on('install_aab', function (event, arg) {
  console.log("请求处理安装 aab 安装包: " + arg);

  // console.log(getJavaPath());

  // 开始 aab 安装处理流程
  parseAabContent(event, arg);
});

/**
 * 发送消息到 UI 界面进行展示
 * @param {Electron.IpcMainEvent} event 
 * @param {*} msg 
 */
function sendMsgToUI(event, msg) {
  event.sender.send('on_install_rsp', `[aab 安装]${msg}\n`);
}

function getAssetsPath() {
  let assets_path = app.isPackaged ? `${process.resourcesPath}/assets` : `${app.getAppPath()}/assets`;
  return assets_path;
}

function getBundletoolJarPath() {
  let bundletool_jar_path = `${getJavaPath()} -jar ${getAssetsPath()}/bundletool-all-0.13.4.jar`;
  return bundletool_jar_path;
}

function getJavaPath() {
  let java_bin_path = `${getAssetsPath()}/java/bin`;
  let java_path = isWinOS() ? `${java_bin_path}/java.exe` : `${java_bin_path}/java`;
  return java_path;
}

function getAdbPath() {
  let adb_path = isWinOS() ? `${getAssetsPath()}/adb.exe` : `${getAssetsPath()}/adb`;
  return adb_path;
}

function getInstallTempPath() {
  let install_temp_path = `${process.resourcesPath}/install_temp`;
  return install_temp_path;
}

/**
 * 第一步：解析 aab 文件，用于获取到应用相关的信息
 * 
 * @param {Electron.IpcMainEvent} event
 * @param {*} aab_file_path 
 */
function parseAabContent(event, aab_file_path) {
  sendMsgToUI(event, `1、正在进行 aab 文件解析：${path.basename(aab_file_path)}`);

  let bundletool_jar_path = getBundletoolJarPath();
  let adb_path = getAdbPath();

  let cmd = `${bundletool_jar_path} dump manifest --adb ${adb_path} --bundle=${aab_file_path}`

  let workerProcess = exec(cmd, (err, stdout, stderr) => {

    if ('' !== stderr) {
      let errorMsg = `获取 aab manifest 文件信息出错，错误信息：${stderr}`;
      sendMsgToUI(event, errorMsg);
      tipsInstallError(errorMsg);
      return;
    }

    xmlReader.read(stdout, function (errors, response) {
      if (null !== errors) {
        let errorMsg = `解析 aab 的清单内容出错：${errors}`;
        log(errorMsg);
        sendMsgToUI(event, errorMsg);
        tipsInstallError(errorMsg);
        return;
      }

      // 获取到应用的包名
      let app_pkg = response.manifest.attributes().package;
      // 获取应用的版本名
      let app_vname = response.manifest.attributes()['android:versionName'];
      // 获取应用的版本号
      let app_vcode = response.manifest.attributes()['android:versionCode'];

      var aabInfo = new AabInfo(app_pkg, app_vname, app_vcode);

      let aabParseRst = `aab 文件解析结果如下👉：\n应用包名：${aabInfo.pkg}，应用版本信息：${aabInfo.getAppVersionInfo()}\n`;

      log(aabParseRst);
      sendMsgToUI(event, aabParseRst);
      generateSpecFile(event, aab_file_path, aabInfo);

      // log(response.manifest);
      // log(response.manifest.application.activity.array[0].attributes()['android:name']);
      // log(response.manifest.application.activity.array[0]['intent-filter'] !== null);
    })
  });
}

/**
 * 第二步：生成设备描述文件
 * @param {Electron.IpcMainEvent} event 
 * @param {*} aab_file_path 
 * @param {AabInfo} aabInfo 
 */
function generateSpecFile(event, aab_file_path, aabInfo) {
  sendMsgToUI(event, `2、正在生成设备描述文件`);

  let install_temp_path = getInstallTempPath();

  // bundletool jar 包路径
  let bundletool_jar_path = getBundletoolJarPath();
  // aab 路径
  let adb_path = getAdbPath();

  // 设备描述文件路径
  let device_spec_file = `${install_temp_path}/device-spec.json`;

  // 1、生成连接设备对应的 spec 文件命令
  let gen_device_spec_cmd = `${bundletool_jar_path} get-device-spec --adb ${adb_path} --output=${device_spec_file} --overwrite`;

  let workerProcess = exec(gen_device_spec_cmd, (errE, stdout) => {
    if (null !== errE) {
      let errorMsg = `生成设备描述文件出错，错误信息：${errE}`;
      sendMsgToUI(event, errorMsg);
      tipsInstallError(errorMsg);
      return;
    }

    sendMsgToUI(event, `设备描述信息生成成功，文件路径👉：\n${device_spec_file}\n`);

    showDeviceSpecFile(event, aab_file_path, aabInfo, device_spec_file)
  });
}

/**
 * 第三步：读取生成的设备描述信息
 * 
 * @param {Electron.IpcMainEvent} event 
 * @param {*} aab_file_path 
 * @param {AabInfo} aabInfo 
 * @param {*} device_spec_file 
 */
function showDeviceSpecFile(event, aab_file_path, aabInfo, device_spec_file) {
  sendMsgToUI(event, `3、读取设备描述信息`);

  readFile.readFile(device_spec_file, 'utf-8', function (error, content) {

    log(content);
    sendMsgToUI(event, `设备描述信息读取成功，内容如下👉：\n${content}\n`);
    buildApksFile(event, aab_file_path, aabInfo, device_spec_file);
  })
}

/**
 * 第四步：根据设备描述文件生成 apks，并安装到连接设备上
 * 
 * @param {Electron.IpcMainEvent} event 
 * @param {*} aab_file_path 
 * @param {AabInfo} aabInfo 
 * @param {*} device_spec_file 
 */
function buildApksFile(event, aab_file_path, aabInfo, device_spec_file) {
  sendMsgToUI(event, `4、正在使用设备描述信息生成 apks 文件`);
  let install_temp_path = getInstallTempPath();

  // bundletool jar 包路径
  let bundletool_jar_path = getBundletoolJarPath();
  // aab 路径
  let adb_path = getAdbPath();

  // apks 文件路径
  let apks_file = `${install_temp_path}/app_bundle.apks`;
  // ks 签名文件路径
  let ks_file = `${getAssetsPath()}/${aabInfo.getKeystoreName()}`;

  log(`拿到的签名文件是：${ks_file}`);

  // 获取签名信息
  let keyStoreConfig = aabInfo.getKeystoreConfig();

  log(`获取到的签名信息：ks_pass=${keyStoreConfig.ks_pass}, alias=${keyStoreConfig.alias}, key_pass=${keyStoreConfig.key_pass}`);

  // 根据 spec 文件生成 apks 文件
  let gen_apks_cmd = `${bundletool_jar_path} build-apks  --adb ${adb_path} --bundle=${aab_file_path} --device-spec=${device_spec_file} --output=${apks_file} --ks=${ks_file} --ks-pass=pass:${keyStoreConfig.ks_pass} --ks-key-alias=${keyStoreConfig.alias} --key-pass=pass:${keyStoreConfig.key_pass} --overwrite`;

  let workerProcess = exec(gen_apks_cmd, (errE, stdout) => {
    if (null !== errE) {
      let errorMsg = `生成 apks 文件出错，错误信息：${errE}`;
      sendMsgToUI(event, errorMsg);
      tipsInstallError(errorMsg);
      return;
    }

    log(`生成 apks 文件成功，文件路径：${apks_file}`);

    sendMsgToUI(event, `生成 apks 文件成功，文件路径👉：\n${apks_file}\n`);
    installApkToDevice(event, aabInfo, apks_file);
  });
}

/**
 * 第五步：将 apks 文件安装到设备中
 * 
 * @param {Electron.IpcMainEvent} event 
 * @param {AabInfo} aabInfo 
 * @param {*} apks_file 
 */
function installApkToDevice(event, aabInfo, apks_file) {
  sendMsgToUI(event, `5、正在将 apks 安装到设备中...`);

  // bundletool jar 包路径
  let bundletool_jar_path = getBundletoolJarPath();
  // aab 路径
  let adb_path = getAdbPath();

  // 3、安装 apks 到连接设备
  let install_apks_cmd = `${bundletool_jar_path} install-apks  --adb ${adb_path} --apks=${apks_file}`;

  let workerProcess = exec(install_apks_cmd, (errE, stdout) => {
    if (null !== errE) {
      let errorMsg = `安装 apks 文件到设备时出错，错误信息：${errE}`;
      sendMsgToUI(event, errorMsg);
      tipsInstallError(errorMsg);
      return;
    }

    sendMsgToUI(event, `已成功将 aab 程序包安装到设备中\n`);
    autoStartApplication(event, aabInfo);
  });
}

/**
 * 第六步：自动启动刚安装完的应用程序
 * 
 * @param {Electron.IpcMainEvent} event 
 * @param {AabInfo} aabInfo 
 */
function autoStartApplication(event, aabInfo) {
  sendMsgToUI(event, `6、正在尝试自动启动应用，包名：${aabInfo.pkg}, 应用版本信息：${aabInfo.getAppVersionInfo()}`);

  let autoStartActivity = aabInfo.getAutoStartActivity();
  if (null == autoStartActivity) {
    sendMsgToUI(event, '抱歉无法自动识别打开应用，你可以手动打开应用进行测试');
    tipsInstallFinish(false, aabInfo);
    return;
  }

  // aab 路径
  let adb_path = getAdbPath();

  // 4、启动刚才安装好的应用
  let start_app_cmd = `${adb_path} shell am start -n "${aabInfo.getAutoStartActivity()}" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER`;

  let workerProcess = exec(start_app_cmd, (errE, stdout) => {
    if (null !== errE) {
      sendMsgToUI(event, `尝试自动启动应用出错，错误信息：${errE}`);
      tipsInstallFinish(false, aabInfo);
      return;
    }

    sendMsgToUI(event, `应用已自动启动，可以开始进行测试验收~~~\n`);
    tipsInstallFinish(true, aabInfo);
  });
}

/**
 * 弹出安装失败的提示框，利于给使用人员强制的提示
 * 
 * @param {*} msg 
 */
function tipsInstallError(msg) {
  var options = {
    type: 'error',
    title: '安装出错',
    icon: nativeImage.createEmpty(),
    message: msg
  }

  dialog.showMessageBox(options);
}

/**
 * 使用强烈的对话框提示已经完成安装
 * 
 * @param {Boolean} is_auto_start 
 * @param {AabInfo} aabInfo 
 */
function tipsInstallFinish(is_auto_start, aabInfo) {

  let version_info = `(应用包名：${aabInfo.pkg}, 版本信息：${aabInfo.getAppVersionInfo()})`;

  var options = {
    type: 'info',
    title: '温馨提示',
    icon: nativeImage.createEmpty(),
    message: is_auto_start ?
      `安装成功，应用已自动启动，可以开始进行测试验收~~~\n${version_info}` :
      `抱歉无法自动识别打开应用，你可以手动打开应用进行测试\n${version_info}`
  }

  dialog.showMessageBox(options);
}

// 判断是否是 window 平台
function isWinOS() {
  let os_info = process.platform;

  if (os_info.startsWith('win')) {
    return true;
  }

  return false;
}

function log(log_str) {
  if (log_str == null || log_str == '') {
    return;
  }

  console.log(log_str);
}

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