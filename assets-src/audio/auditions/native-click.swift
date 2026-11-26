// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Native input fallback for Qt controls without AXPress actions.
// Coordinates MUST come from the observed Audacity AX tree/screenshot.
import Cocoa
import CoreGraphics
let pid = pid_t(CommandLine.arguments[1])!
let x = Double(CommandLine.arguments[2])!
let y = Double(CommandLine.arguments[3])!
Thread.sleep(forTimeInterval: 0.15)
let p = CGPoint(x: x, y: y)
CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.15)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.05)
CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.2)
