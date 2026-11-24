#include <ApplicationServices/ApplicationServices.h>
#include <CoreGraphics/CoreGraphics.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static CGEventSourceRef source;
static int left_held = 0;

/** Post one mouse event at the current cursor position. */
static int post_mouse(CGEventType type, CGMouseButton button, int dry_run) {
  if (dry_run) return 1;
  CGEventRef position = CGEventCreate(source);
  if (!position) return 0;
  CGPoint point = CGEventGetLocation(position);
  CFRelease(position);
  CGEventRef event = CGEventCreateMouseEvent(source, type, point, button);
  if (!event) return 0;
  CGEventPost(kCGHIDEventTap, event);
  CFRelease(event);
  return 1;
}

/** CoreGraphics needs both the destination in desktop points and the relative deltas. */
static CGEventRef create_move(CGPoint from, int dx, int dy) {
  CGPoint to = CGPointMake(from.x + dx, from.y + dy);
  CGEventRef event = CGEventCreateMouseEvent(source,
    left_held ? kCGEventLeftMouseDragged : kCGEventMouseMoved, to, kCGMouseButtonLeft);
  if (event) {
    CGEventSetIntegerValueField(event, kCGMouseEventDeltaX, dx);
    CGEventSetIntegerValueField(event, kCGMouseEventDeltaY, dy);
  }
  return event;
}

/** Parse and execute the server's line-oriented mouse protocol. */
static int execute(const char *line, int dry_run) {
  int x, y;
  char tail;
  if (sscanf(line, "MOVE %d %d %c", &x, &y, &tail) == 2) {
    if (dry_run) return 1;
    CGEventRef position = CGEventCreate(source);
    if (!position) return 0;
    CGPoint point = CGEventGetLocation(position);
    CFRelease(position);
    CGEventRef event = create_move(point, x, y);
    if (!event) return 0;
    CGEventPost(kCGHIDEventTap, event);
    CFRelease(event);
    return 1;
  }
  if (strcmp(line, "LEFT_DOWN") == 0) {
    if (!post_mouse(kCGEventLeftMouseDown, kCGMouseButtonLeft, dry_run)) return 0;
    left_held = 1;
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
    // The phone sends 120 units per wheel detent. CoreGraphics expects lines.
    int lines = y / 120;
    if (!lines) return 1;
    CGEventRef event = CGEventCreateScrollWheelEvent(source, kCGScrollEventUnitLine, 1, lines);
    if (!event) return 0;
    CGEventPost(kCGHIDEventTap, event);
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
    CGEventRef move = create_move(CGPointMake(-50, 100), 3, -2);
    if (!move) return 1;
    CGPoint target = CGEventGetLocation(move);
    int move_ok = target.x == -47 && target.y == 98 &&
      CGEventGetIntegerValueField(move, kCGMouseEventDeltaX) == 3 &&
      CGEventGetIntegerValueField(move, kCGMouseEventDeltaY) == -2 &&
      CGEventGetType(move) == kCGEventMouseMoved;
    CFRelease(move);
    if (!move_ok || !execute("LEFT_DOWN", 1)) return 1;
    CGEventRef drag = create_move(CGPointZero, 1, 1);
    if (!drag) return 1;
    int drag_ok = CGEventGetType(drag) == kCGEventLeftMouseDragged;
    CFRelease(drag);
    if (!drag_ok) return 1;
    puts("SELF_TEST_OK");
    return 0;
  }

  if (!CGPreflightPostEventAccess() && !CGRequestPostEventAccess()) {
    fprintf(stderr, "ACCESSIBILITY_REQUIRED: Enable Gyroclopter in System Settings > Privacy & Security > Accessibility. If permission is still denied, add the mouse helper (%s), then fully quit and reopen Gyroclopter.\n", argv[0]);
    return 2;
  }

  source = CGEventSourceCreate(kCGEventSourceStateCombinedSessionState);
  if (!source) return 1;
  CGEventSourceSetLocalEventsSuppressionInterval(source, 0);

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
  CFRelease(source);
  return 0;
}
