// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Apple ImageIO takes the top-left pixel rectangle of the native screenshot.
ObjC.import('Foundation');
ObjC.import('CoreGraphics');
ObjC.import('ImageIO');
function run(argv) {
  const [source, target, x, y, width, height] = argv;
  const input = $.CGImageSourceCreateWithURL($.NSURL.fileURLWithPath(source), null);
  const raw = $.CGImageSourceCreateImageAtIndex(input, 0, null);
  const crop = $.CGImageCreateWithImageInRect(raw, $.CGRectMake(Number(x), Number(y), Number(width), Number(height)));
  if (Number($.CGImageGetWidth(crop)) !== Number(width) || Number($.CGImageGetHeight(crop)) !== Number(height)) throw Error('Native crop dimensions disagree');
  const dest = $.CGImageDestinationCreateWithURL($.NSURL.fileURLWithPath(target), $('public.png'), 1, null);
  $.CGImageDestinationAddImage(dest, crop, null);
  if (!$.CGImageDestinationFinalize(dest)) throw Error('Native crop could not be written');
}
