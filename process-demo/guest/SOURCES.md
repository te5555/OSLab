# Browser Linux runtime

The page starts a new module worker and v86 instance for each run. All runtime assets load from this directory on the same HTTP origin. The guest kernel exposes Linux process and file APIs. TinyCC produces a native i386 Linux executable inside the guest. The supervisor waits for the initial process and any remaining descendants, then returns the initial process’s exit status. The browser terminates the worker when the run completes or reaches its deadline.

## Upstream components

| Files | Version and source |
| --- | --- |
| libv86.mjs, v86.wasm | [v86 npm archive 0.5.473](https://registry.npmjs.org/v86/-/v86-0.5.473.tgz), from [source revision 315b2b0](https://github.com/copy/v86/tree/315b2b0b758703ef0e6cc7b4088d6068f83f3c20). BSD-2-Clause, with SoftFloat, zstd and QEMU floppy-driver code under their upstream terms. |
| seabios.bin, vgabios.bin | Published [BIOS](https://copy.sh/v86/bios/seabios.bin) and [VGA BIOS](https://copy.sh/v86/bios/vgabios.bin). The upstream [build script and configs](https://github.com/copy/v86/tree/315b2b0b758703ef0e6cc7b4088d6068f83f3c20/bios) use [SeaBIOS 1.16.2](https://www.seabios.org/). LGPL. |
| buildroot.bin | Unmodified [v86 Buildroot image](https://i.copy.sh/buildroot-bzimage68.bin). The image reports [Linux 6.8.12](https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.8.12.tar.xz), [Buildroot 2024.05.2](https://buildroot.org/downloads/buildroot-2024.05.2.tar.xz) and [BusyBox 1.36.1](https://busybox.net/downloads/busybox-1.36.1.tar.bz2). Linux and BusyBox use GPLv2. User-space packages carry their individual licenses. |
| compiler.cpio.gz | Alpine x86 TinyCC and musl binaries, headers, guest init and supervisor source. The [TinyCC recipe and patches](https://gitlab.alpinelinux.org/alpine/aports/-/tree/7d28fa03ec6ea53097d6035da0db66a9a9015b31/community/tcc) use [source d9d02c5](https://dev.alpinelinux.org/archive/tcc/tcc-d9d02c56401e43be43760b63f7d82f771a7ed1f6.tar.gz), LGPL-2.1-or-later. The [musl 1.2.5 recipe and patches](https://gitlab.alpinelinux.org/alpine/aports/-/tree/5245849e14d213abe18d589b4b80d65793327940/main/musl) use [upstream musl](https://musl.libc.org/releases/musl-1.2.5.tar.gz), MIT with additional notices. |

License texts are in the licenses directory. The exact downloaded artifacts are listed in build/inputs.sha256.

## Rebuild the compiler archive

From the guest directory, using an empty temporary directory as the working directory for dependencies:

```sh
mkdir -p /tmp/oslab-apks
for pkg in tcc tcc-dev tcc-libs; do
  curl -fL "https://dl-cdn.alpinelinux.org/alpine/edge/community/x86/${pkg}-0.9.27_git20260714-r1.apk" -o "/tmp/oslab-apks/${pkg}.apk"
done
for pkg in musl musl-dev; do
  curl -fL "https://dl-cdn.alpinelinux.org/alpine/v3.21/main/x86/${pkg}-1.2.5-r12.apk" -o "/tmp/oslab-apks/${pkg}.apk"
done
python3 build/make-overlay.py /tmp/oslab-apks compiler.cpio.gz
```

The overlay builder extracts the dynamically linked compiler and development headers, provides the i386 startup-object path expected by TinyCC, and installs the two sources from build. Alpine repositories rotate versions, so validate any replacement archive against its own source and hashes before rebuilding.
