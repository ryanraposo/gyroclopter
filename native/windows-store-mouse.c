#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <string.h>

static int left_held;

/** Parse one mouse command and submit relative input to the interactive desktop. */
static int execute(const char *line, int dry_run) {
  INPUT events[2] = {0};
  events[0].type = INPUT_MOUSE;
  UINT count = 1;
  int x, y, next_held = left_held;
  char tail;

  if (sscanf_s(line, "MOVE %d %d %c", &x, &y, &tail, 1u) == 2) {
    events[0].mi.dx = x;
    events[0].mi.dy = y;
    events[0].mi.dwFlags = MOUSEEVENTF_MOVE;
  } else if (strcmp(line, "LEFT_DOWN") == 0) {
    events[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    next_held = 1;
  } else if (strcmp(line, "LEFT_UP") == 0) {
    events[0].mi.dwFlags = MOUSEEVENTF_LEFTUP;
    next_held = 0;
  } else if (strcmp(line, "CLICK_RIGHT") == 0) {
    events[0].mi.dwFlags = MOUSEEVENTF_RIGHTDOWN;
    events[1].type = INPUT_MOUSE;
    events[1].mi.dwFlags = MOUSEEVENTF_RIGHTUP;
    count = 2;
  } else if (sscanf_s(line, "SCROLL %d %c", &y, &tail, 1u) == 1) {
    events[0].mi.dwFlags = MOUSEEVENTF_WHEEL;
    events[0].mi.mouseData = (DWORD)y;
  } else {
    return 0;
  }

  if (!dry_run && SendInput(count, events, sizeof(INPUT)) != count) {
    return 0;
  }
  left_held = next_held;
  return 1;
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "--self-test") == 0) {
    if (!execute("LEFT_DOWN", 1) || !left_held ||
        !execute("MOVE 3 -2", 1) || !execute("LEFT_UP", 1) || left_held ||
        !execute("CLICK_RIGHT", 1) || !execute("SCROLL -120", 1) ||
        execute("MOVE 3 -2 trailing", 1)) return 1;
    puts("SELF_TEST_OK");
    return 0;
  }

  puts("READY");
  fflush(stdout);
  char line[128];
  int failure_reported = 0;
  while (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = '\0';
    if (!execute(line, 0) && !failure_reported) {
      fputs("Windows rejected a mouse event. Switch out of elevated apps or secure desktop prompts.\n", stderr);
      fflush(stderr);
      failure_reported = 1;
    }
  }
  if (left_held) execute("LEFT_UP", 0);
  return 0;
}
