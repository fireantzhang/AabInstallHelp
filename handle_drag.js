String.prototype.endswith = function (endStr) {
    var d = this.length - endStr.length;
    return (d >= 0 && this.lastIndexOf(endStr) == d)
}

//拖拽文件到窗口事件
const holder = document.getElementById('holder');
const message = document.getElementById('message');

holder.ondragente = holder.ondragover = (event) => {
    event.preventDefault();

    holder.className = "dropify-wrapper-ondrag";

    message.innerHTML = "松开进行安装";
}

holder.ondragend = holder.ondragleave = (event) => {

    setMessageInitStatus();
}

holder.ondrop = (e) => {
    e.preventDefault()
    for (let f of e.dataTransfer.files) {

        var filepath = f.path;

        console.log(`识别到拖拽文件进来: ${filepath}`);

        if (!filepath.endswith('.aab')) {
            setMessageInitStatus();
            alert(`抱歉，不能处理非 aab 后缀的文件： + ${filepath}，请选择标准的 aab 安装文件进行安装。`);
            return false;
        }

        message.innerHTML = "已选择文件：" + f.path + "<br><br>";

        holder.className = "dropify-wrapper";

        start_process_aab(filepath);
    }
}

function setMessageInitStatus() {
    holder.className = "dropify-wrapper";
    message.innerHTML = "点击或将文件拖拽到此区域处理(aab 格式的安装包)";
}