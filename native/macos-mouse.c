#include <ApplicationServices/ApplicationServices.h>
#include <CoreGraphics/CoreGraphics.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static CGMouseButton held_button = kCGMouseButtonLeft;
static int left_held = 0;

/** Post one mouse event at the current cursor position. */
static int post_mouse(CGEventType type, CGMouseButton button, int dry_run) {
  if (dry_run) return 1;
  CGEventRef position = CGEventCreate(NULL);
  if (!position) return 0;
  CGPoint point = CGEventGetLocation(position);
  CFRelease(position);
  CGEventRef event = CGEventCreateMouseEvent(NULL, type, point, button);
  if (!event) return 0;
  if (!dry_run) CGEventPost(kCGHIDEventTap, event);
  CFRelease(event);
  return 1;
}

/** Parse and execute the server's line-oriented mouse protocol. */
static int execute(const char *line, int dry_run) {
  int x, y;
  char tail;
  if (sscanf(line, "MOVE %d %d %c", &x, &y, &tail) == 2) {
    if (dry_run) return 1;
    CGEventRef position = CGEventCreate(NULL);
    if (!position) return 0;
    CGPoint point = CGEventGetLocation(position);
    CFRelease(position);
    point.x += x;
    point.y += y;
    CGEventRef event = CGEventCreateMouseEvent(NULL,
      left_held ? kCGEventLeftMouseDragged : kCGEventMouseMoved,
      point, held_button);
    if (!event) return 0;
    if (!dry_run) CGEventPost(kCGHIDEventTap, event);
    CFRelease(event);
    return 1;
  }
  if (strcmp(line, "LEFT_DOWN") == 0) {
    if (!post_mouse(kCGEventLeftMouseDown, kCGMouseButtonLeft, dry_run)) return 0;
    left_held = 1;
    held_button = kCGMouseButtonLeft;
    return 1;
  }
  if (strcmp(line, "LEFT_UP") == 0) {
    if (!post_mouse(kCGEventLeftMouseUp, kCGMouseButtonLeft, dry_run)) return 0;
    left_held = 0;
    return 1;
  }
  if (strcmp(line, "CLICK_RIGHT") == 0) {
    return post_mouse(kCGEventRightMouseDown, kCGMouseButtonRight, dry_run) &&
      post_mouse(kCGEventRightMouseUp, kCGMouseButtonRight, dry_run);
  }
  if (sscanf(line, "SCROLL %d %c", &y, &tail) == 1) {
    if (dry_run) return 1;
    CGEventRef event = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitLine, 1, y);
    if (!event) return 0;
    if (!dry_run) CGEventPost(kCGHIDEventTap, event);
    CFRelease(event);
    return 1;
  }
  return 0;
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "--self-test") == 0) {
    const char *commands[] = { "MOVE 3 -2", "LEFT_DOWN", "MOVE 1 1",
      "LEFT_UP", "CLICK_RIGHT", "SCROLL -1" };
    for (size_t i = 0; i < sizeof(commands) / sizeof(commands[0]); i++) {
      if (!execute(commands[i], 1)) return 1;
    }
    if (execute("INVALID", 1)) return 1;
    puts("SELF_TEST_OK");
    return 0;
  }

  const void *keys[] = { kAXTrustedCheckOptionPrompt };
  const void *values[] = { kCFBooleanTrue };
  CFDictionaryRef options = CFDictionaryCreate(NULL, keys, values, 1,
    &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  int trusted = AXIsProcessTrustedWithOptions(options);
  CFRelease(options);
  if (!trusted) {
    fputs("ACCESSIBILITY_REQUIRED: Allow Gyroclopter in System Settings > Privacy & Security > Accessibility, then restart the server.\n", stderr);
    return 2;
  }

  puts("READY");
  fflush(stdout);
  char line[128];
  while (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = '\0';
    if (strcmp(line, "exit") == 0) break;
    if (!execute(line, 0)) {
      fprintf(stderr, "INVALID_COMMAND: %s\n", line);
      fflush(stderr);
    }
  }
  if (left_held) post_mouse(kCGEventLeftMouseUp, kCGMouseButtonLeft, 0);
  return 0;
}
