#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

/* Reap orphaned descendants as well as the original main() process. */
static int set_limit(int resource, rlim_t maximum) {
    struct rlimit limit = {maximum, maximum};
    return setrlimit(resource, &limit);
}

int main(void) {
    if (prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0)) {
        perror("prctl");
        return 125;
    }
    pid_t main_pid = fork();
    if (main_pid < 0) { perror("fork"); return 125; }
    if (main_pid == 0) {
        if (chdir("/tmp") || setgroups(0, NULL) || setgid(65534) || setuid(65534) ||
            set_limit(RLIMIT_NPROC, 48) || set_limit(RLIMIT_NOFILE, 64) ||
            set_limit(RLIMIT_CORE, 0) || set_limit(RLIMIT_FSIZE, 65536)) {
            perror("guest setup");
            _exit(125);
        }
        execl("/tmp/student", "student", (char *) NULL);
        perror("exec");
        _exit(125);
    }
    int main_status = 125;
    int status;
    for (;;) {
        pid_t finished = waitpid(-1, &status, 0);
        if (finished < 0) {
            if (errno == EINTR) continue;
            break;
        }
        if (finished == main_pid)
            main_status = WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
    }
    return main_status;
}
