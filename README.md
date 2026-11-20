# OSLab · 操作系统课程实验

学生可以在同一页对照课件、修改 C 源码，并在浏览器里的 Linux 环境中编译运行。仓库目前收录了第 9 讲《进程》。想先体验效果，可以在 GitHub 的 ZIP 文件页点击 **Download raw file**，解压后用桌面版 Chrome 打开 `fork-demo.html`。[离线演示包](share/fork-demo.zip) · [示例源码](process-demo/)

**授课教师和助教决定各讲的主题、讲义、示例和练习，并确认预期结果。网站维护者负责页面模板、浏览器运行环境、打包和技术故障。** 现有的 `fork()` 实验可以作为排版和操作示例，后续讲次按课程组自己的教学安排添加。

## 给授课教师和助教

如果你只想提供材料，可以把下面几项交给负责录入的同事。熟悉 Git 的同事也可以直接发起 Pull Request（合并请求）。

| 材料 | 写清什么 |
| --- | --- |
| 讲次和标题 | 学期、讲次、在课表中显示的名称 |
| 课件或阅读材料 | PDF 文件或链接，需要学生看的页码。如需页内预览，附该页截图 |
| 课堂示例（如有） | 一份可独立编译的 C 源文件，以及学生应该观察什么 |
| 练习（如有） | 建议学生改哪一行、重新运行后比较什么 |

预期结果可以写成一个可观察的现象。例如，第 9 讲可以写「父子进程都读到初值 42。只在子进程中执行 `x++` 后，父进程仍打印 42」。实际的进程号和输出先后顺序可以变化。

## 只添加课件、作业或阅读材料

学期课表在课程主页仓库的 `_courses/2026Spring-OS/main.md` 中。编辑对应日期的一行，把讲义 PDF 放到「课件」列，把作业要求放到「作业」列。可以沿用现有文件路径（如 `/assets/pdf/2026Spring-OS/`），也可以填写材料的完整网址。需要补充阅读时，可以在同一课件单元格追加阅读链接。没有配套实验的讲次，「相关代码」留空即可。[查看并编辑课表源文件](https://github.com/niuxintao/niuxintao.github.io/blob/master/_courses/2026Spring-OS/main.md)

## 在已有讲次中补充内容

以 [process-demo/](process-demo/) 为例，按要修改的内容找到源文件。

| 要改什么 | 改哪里 |
| --- | --- |
| 讲义、阅读链接、思考题 | [index.html](process-demo/index.html) 中的 `#overview` 和 `#practice`。普通链接或列表项即可。 |
| 编辑器初始代码 | [main.c](process-demo/main.c)。页面加载和「还原源码」都使用这份文件。 |
| 课件与页内预览 | 修改 `index.html` 中 `id="slides"` 链接的 PDF 地址和 `#page=页码`，替换 [slide-18.png](process-demo/slide-18.png)，同步修改按钮页码、弹窗说明和图片的 `alt`。 |
| 本讲目录和搜索词 | 修改 `index.html` 中的 `.section-links`。新增小节时，目录链接的 `href="#小节名"` 要与正文的 `id="小节名"` 对应，搜索词写在链接的 `data-keywords` 中。 |

## 新增一讲可运行的实验

下面以新目录 `my-demo/` 为例。请在仓库根目录操作，并把目录名换成本讲要使用的名称。

1. 新建目录，复制讲义、源程序和课件截图。新实验与原实验各自维护一份 `main.c`。

   ```sh
   mkdir my-demo && cp process-demo/index.html process-demo/main.c process-demo/slide-18.png my-demo/
   ```

2. 在 `my-demo/index.html` 的 `<head>` 中，把样式和脚本的引用改成下面两行。这样每一讲都能共用编辑器和 Linux 运行环境，无需再复制虚拟机镜像。

   ```html
   <link rel="stylesheet" href="../process-demo/lab.css">
   <script src="../process-demo/lab.js" defer></script>
   ```

3. 换上本讲的 `main.c` 和截图，在 HTML 中更新浏览器标题、侧栏讲次、正文、示意图、练习、搜索词及课件链接。如果截图改了文件名，也要更新弹窗的 `<img src="…">`。编辑器、终端和弹窗控件现有的 `id` 供共用脚本定位，修改这些控件的文字即可。
4. 用下一节的命令预览，打开 `http://127.0.0.1:8000/my-demo/`。确认编辑器显示本讲的程序，改动源码能改变运行结果，课件按钮能打开正确的一页。

当前编辑器每次编译一份 `main.c`，每次运行使用新的 Linux 实例。若示例需要多个源文件、额外的数据文件或交互式输入，请把这些依赖随材料说明，方便网站维护者适配。

## 预览、打包与提交

### 在电脑上预览

在仓库根目录用 Python 3 启动静态文件服务。C 编译器已随页面提供。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

服务启动后，用 Chrome 打开 `http://127.0.0.1:8000/process-demo/`。预览新讲次时，把地址末尾的 `process-demo/` 换成新目录名。预览结束后，在终端按 Ctrl+C。

### 更新第 9 讲的离线包

修改源文件后，从仓库根目录运行下面的命令。它会重新生成 [share/fork-demo.html](share/fork-demo.html) 和 [share/fork-demo.zip](share/fork-demo.zip)。解压 ZIP，在 Chrome 里打开 HTML，检查一次课件预览和代码运行，再将两个产物与源文件一起提交。

```sh
python3 tools/package_demo.py
```

[打包脚本](tools/package_demo.py) 目前固定读取 `process-demo/` 和 `slide-18.png`，输出名固定为 `fork-demo`。新增讲次按上述步骤即可通过本地 HTTP 服务预览。如果也需要离线分发，请让网站维护者扩展脚本，读取新讲次的 HTML、C 源码和截图，内嵌共用的样式、脚本及 Linux 资源，并使用独立的输出文件名。

### 让学生从课表进入实验

在本仓库提交 Pull Request，注明讲次、本地预览路径和预期运行结果。页面部署到静态网站后，在课程主页仓库中把**学生能直接打开的实验网址**填入该讲的「相关代码」一栏。发布后，从课表点击一次，确认可以打开实验并运行。[2026 春季课表](https://niuxintao.github.io/courses/2026Spring-OS/main/)
