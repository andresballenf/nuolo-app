const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const patches = [
  {
    relativePath: 'node_modules/expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift',
    find: 'public final class HostingView<Props: ViewProps, ContentView: View<Props>>: ExpoView, @MainActor AnyExpoSwiftUIHostingView {',
    replace:
      '@MainActor\n  public final class HostingView<Props: ViewProps, ContentView: View<Props>>: ExpoView, AnyExpoSwiftUIHostingView {',
  },
  {
    relativePath: 'node_modules/expo-modules-core/ios/Core/Views/ViewDefinition.swift',
    find: 'extension UIView: @MainActor AnyArgument {',
    replace: '@MainActor extension UIView: AnyArgument {',
  },
  {
    relativePath: 'node_modules/expo-audio/ios/AudioRecordingRequester.swift',
    find:
      'EXFatal(EXErrorWithMessage("""\n        This app is missing NSMicrophoneUsageDescription, so audio services will fail.\n        Add one of these keys to your bundle\'s Info.plist.\n      """))',
    replace:
      'NSLog("This app is missing NSMicrophoneUsageDescription, so audio services will fail.")',
  },
];

let patchedCount = 0;

for (const patch of patches) {
  const filePath = path.join(rootDir, patch.relativePath);
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(patch.find)) {
    continue;
  }

  const updated = content.replace(patch.find, patch.replace);
  fs.writeFileSync(filePath, updated);
  patchedCount += 1;
}

if (patchedCount > 0) {
  console.log(`Patched iOS dependency files (${patchedCount}).`);
} else {
  console.log('No iOS dependency patches were needed.');
}
