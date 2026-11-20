#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    int x = 42;
    int ret = fork();

    if (ret < 0) {
        perror("fork");
        return 1;
    }
    if (ret == 0) {
        printf("child   ret = %d, x = %d\n", ret, x);
    } else {
        printf("parent  ret = %d, x = %d\n", ret, x);
        waitpid(ret, NULL, 0);
    }
    return 0;
}
