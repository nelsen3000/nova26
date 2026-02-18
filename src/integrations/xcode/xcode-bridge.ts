// Xcode Integration - Bridge between NOVA26 and Xcode
// Build iOS apps alongside web projects

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface XcodeProject {
  name: string;
  bundleId: string;
  deploymentTarget: string;
  swiftVersion: string;
  dependencies: string[];
}

interface BuildConfig {
  scheme: string;
  configuration: 'Debug' | 'Release';
  destination: string;
  derivedDataPath?: string;
}

interface BuildResult {
  success: boolean;
  output: string;
  warnings: string[];
  errors: string[];
  appPath?: string;
}

// Check if Xcode is installed
export function checkXcodeInstallation(): boolean {
  try {
    execSync('xcode-select -p', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Get Xcode version
export function getXcodeVersion(): string | null {
  try {
    const output = execSync('xcodebuild -version', { encoding: 'utf-8' });
    const match = output.match(/Xcode (\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Create new Xcode project from template
export function createXcodeProject(
  projectName: string,
  targetDir: string,
  options: Partial<XcodeProject> = {}
): void {
  const project: XcodeProject = {
    name: projectName,
    bundleId: `com.${projectName.toLowerCase()}.app`,
    deploymentTarget: '16.0',
    swiftVersion: '5.9',
    dependencies: ['ConvexMobile'],
    ...options,
  };

  const projectDir = join(targetDir, `${projectName}.xcodeproj`);
  mkdirSync(projectDir, { recursive: true });

  // Generate project.pbxproj
  const pbxproj = generatePBXProj(project);
  writeFileSync(join(projectDir, 'project.pbxproj'), pbxproj);

  // Create source directories
  const sourceDir = join(targetDir, projectName);
  mkdirSync(join(sourceDir, 'App'), { recursive: true });
  mkdirSync(join(sourceDir, 'Views'), { recursive: true });
  mkdirSync(join(sourceDir, 'ViewModels'), { recursive: true });
  mkdirSync(join(sourceDir, 'Models'), { recursive: true });
  mkdirSync(join(sourceDir, 'Services'), { recursive: true });
  mkdirSync(join(sourceDir, 'Resources'), { recursive: true });

  // Generate core files
  generateCoreFiles(project, sourceDir);

  console.log(`✅ Xcode project "${projectName}" created at ${targetDir}`);
}

// Generate project.pbxproj content
function generatePBXProj(project: XcodeProject): string {
  // Simplified PBXProj - in production, use xcodeproj gem or similar
  return `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    /* Begin PBXBuildFile section */
    /* End PBXBuildFile section */

    /* Begin PBXFileReference section */
    ${project.name} /* ${project.name} */ = { isa = PBXFileReference; lastKnownFileType = folder; path = ${project.name}; sourceTree = "<group>"; };
    /* End PBXFileReference section */

    /* Begin PBXFrameworksBuildPhase section */
    /* End PBXFrameworksBuildPhase section */

    /* Begin PBXGroup section */
    /* End PBXGroup section */

    /* Begin PBXNativeTarget section */
    ${project.name} /* ${project.name} */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = /* ref */;
      buildPhases = (
        /* SourcesBuildPhase */,
        /* FrameworksBuildPhase */,
        /* ResourcesBuildPhase */,
      );
      buildRules = ();
      dependencies = ();
      name = ${project.name};
      productName = ${project.name};
      productReference = /* ref */;
      productType = "com.apple.product-type.application";
    };
    /* End PBXNativeTarget section */

    /* Begin PBXProject section */
    /* Project object */
    /* End PBXProject section */

    /* Begin PBXSourcesBuildPhase section */
    /* End PBXSourcesBuildPhase section */

    /* Begin XCBuildConfiguration section */
    Debug = {
      isa = XCBuildConfiguration;
      buildSettings = {
        SWIFT_VERSION = ${project.swiftVersion};
        IPHONEOS_DEPLOYMENT_TARGET = ${project.deploymentTarget};
        PRODUCT_BUNDLE_IDENTIFIER = ${project.bundleId};
      };
      name = Debug;
    };
    Release = {
      isa = XCBuildConfiguration;
      buildSettings = {
        SWIFT_VERSION = ${project.swiftVersion};
        IPHONEOS_DEPLOYMENT_TARGET = ${project.deploymentTarget};
        PRODUCT_BUNDLE_IDENTIFIER = ${project.bundleId};
      };
      name = Release;
    };
    /* End XCBuildConfiguration section */
  };
  rootObject = /* Project */;
}
`;
}

// Generate core Swift files
function generateCoreFiles(project: XcodeProject, sourceDir: string): void {
  // App.swift
  const appSwift = `import SwiftUI
import ConvexMobile

@main
struct ${project.name}App: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure Convex
        ConvexClient.configure(with: "YOUR_CONVEX_URL")
        
        // Request push notification permissions
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
        
        return true
    }
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        // Send to Convex
    }
}
`;
  writeFileSync(join(sourceDir, 'App', `${project.name}App.swift`), appSwift);

  // ContentView.swift
  const contentView = `import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = ContentViewModel()
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading...")
                } else if let error = viewModel.error {
                    ErrorView(error: error, retry: viewModel.load)
                } else {
                    List(viewModel.items) { item in
                        ItemRow(item: item)
                    }
                    .refreshable {
                        await viewModel.load()
                    }
                }
            }
            .navigationTitle("${project.name}")
        }
        .task {
            await viewModel.load()
        }
    }
}

struct ItemRow: View {
    let item: Item
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title)
                .font(.headline)
            Text(item.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}

struct ErrorView: View {
    let error: Error
    let retry: () async -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)
            
            Text("Something went wrong")
                .font(.headline)
            
            Text(error.localizedDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Button("Try Again") {
                Task { await retry() }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
`;
  writeFileSync(join(sourceDir, 'Views', 'ContentView.swift'), contentView);

  // ViewModel.swift
  const viewModel = `import Foundation
import ConvexMobile

@MainActor
class ContentViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var isLoading = false
    @Published var error: Error?
    
    private let convex = ConvexClient.shared
    
    func load() async {
        isLoading = true
        error = nil
        
        do {
            items = try await convex.query("items:list", ["limit": 50])
        } catch {
            self.error = error
        }
        
        isLoading = false
    }
    
    func createItem(title: String, description: String) async {
        do {
            let newItem: Item = try await convex.mutation("items:create", [
                "title": title,
                "description": description
            ])
            items.insert(newItem, at: 0)
        } catch {
            self.error = error
        }
    }
}
`;
  writeFileSync(join(sourceDir, 'ViewModels', 'ContentViewModel.swift'), viewModel);

  // Model.swift
  const model = `import Foundation

struct Item: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case title
        case description
        case createdAt = "_creationTime"
    }
}
`;
  writeFileSync(join(sourceDir, 'Models', 'Item.swift'), model);

  // Info.plist
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>${project.bundleId}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <true/>
    </dict>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
    <key>UIBackgroundModes</key>
    <array>
        <string>remote-notification</string>
    </array>
</dict>
</plist>
`;
  writeFileSync(join(sourceDir, 'Info.plist'), infoPlist);
}

// Build Xcode project
export async function buildXcodeProject(
  projectPath: string,
  config: BuildConfig
): Promise<BuildResult> {
  const cmd = [
    'xcodebuild',
    '-project', projectPath,
    '-scheme', config.scheme,
    '-configuration', config.configuration,
    '-destination', config.destination,
  ];

  if (config.derivedDataPath) {
    cmd.push('-derivedDataPath', config.derivedDataPath);
  }

  return new Promise((resolve) => {
    const warnings: string[] = [];
    const errors: string[] = [];
    let output = '';

    const childProcess = spawn(cmd[0], cmd.slice(1), {
      cwd: process.cwd(),
      env: process.env,
    });

    childProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;

      // Parse warnings
      const warningMatch = text.match(/warning:\s*(.+)/gi);
      if (warningMatch) {
        warnings.push(...warningMatch.map((w: string) => w.replace(/warning:\s*/i, '')));
      }

      // Parse errors
      const errorMatch = text.match(/error:\s*(.+)/gi);
      if (errorMatch) {
        errors.push(...errorMatch.map((e: string) => e.replace(/error:\s*/i, '')));
      }
    });

    childProcess.on('close', (code: number) => {
      const success = code === 0;
      
      resolve({
        success,
        output,
        warnings: [...new Set(warnings)],
        errors: [...new Set(errors)],
        appPath: success ? findAppPath(output) : undefined,
      });
    });
  });
}

// Find built app path from xcodebuild output
function findAppPath(output: string): string | undefined {
  const match = output.match(/Touch\s+(.+\.app)/);
  return match ? match[1] : undefined;
}

// Run on iOS Simulator
export async function runOnSimulator(
  appPath: string,
  deviceId: string
): Promise<void> {
  try {
    // Install app
    execSync(`xcrun simctl install ${deviceId} "${appPath}"`, { stdio: 'inherit' });
    
    // Launch app
    const bundleId = extractBundleId(appPath);
    execSync(`xcrun simctl launch ${deviceId} ${bundleId}`, { stdio: 'inherit' });
    
    console.log('✅ App launched on simulator');
  } catch (error) {
    console.error('❌ Failed to run app:', error);
    throw error;
  }
}

// Extract bundle ID from app
function extractBundleId(appPath: string): string {
  try {
    const infoPlist = join(appPath, 'Info.plist');
    const content = readFileSync(infoPlist, 'utf-8');
    const match = content.match(/CFBundleIdentifier.*?<string>(.+?)<\/string>/s);
    return match ? match[1] : 'com.example.app';
  } catch {
    return 'com.example.app';
  }
}

// List available simulators
export function listSimulators(): Array<{ id: string; name: string; status: string }> {
  try {
    const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf-8' });
    const data = JSON.parse(output);
    
    const simulators: Array<{ id: string; name: string; status: string }> = [];
    
    for (const [runtime, devices] of Object.entries(data.devices)) {
      if (!runtime.includes('iOS')) continue;
      
      for (const device of devices as any[]) {
        if (device.isAvailable) {
          simulators.push({
            id: device.udid,
            name: device.name,
            status: device.state,
          });
        }
      }
    }
    
    return simulators;
  } catch {
    return [];
  }
}

// Sync Convex schema to iOS models
export function generateSwiftModels(schema: any): string {
  const lines = [
    '// Auto-generated from Convex schema',
    'import Foundation',
    '',
  ];

  for (const [tableName, tableSchema] of Object.entries(schema.tables || {})) {
    const structName = capitalize(tableName.slice(0, -1)); // Remove 's' suffix
    
    lines.push(`struct ${structName}: Identifiable, Codable {`);
    
    for (const [fieldName, fieldType] of Object.entries((tableSchema as any).fields || {})) {
      const swiftType = mapToSwiftType(fieldType as string);
      lines.push(`    let ${fieldName}: ${swiftType}`);
    }
    
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function mapToSwiftType(convexType: string): string {
  const typeMap: Record<string, string> = {
    'v.string()': 'String',
    'v.number()': 'Double',
    'v.boolean()': 'Bool',
    'v.id()': 'String',
    'v.optional()': 'Optional',
  };
  return typeMap[convexType] || 'Any';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// CLI command handler
export async function handleXcodeCommand(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case 'create':
      const [projectName, targetDir = '.'] = rest;
      if (!projectName) {
        console.error('Usage: /xcode create <project-name> [target-dir]');
        return;
      }
      createXcodeProject(projectName, targetDir);
      break;

    case 'build':
      const [projectPath = '.'] = rest;
      const result = await buildXcodeProject(projectPath, {
        scheme: 'App',
        configuration: 'Debug',
        destination: 'platform=iOS Simulator,name=iPhone 15',
      });
      
      console.log(result.success ? '✅ Build successful' : '❌ Build failed');
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
      }
      break;

    case 'simulators':
      const sims = listSimulators();
      console.log('Available Simulators:');
      sims.forEach(s => console.log(`  ${s.id} - ${s.name} (${s.status})`));
      break;

    case 'check':
      if (checkXcodeInstallation()) {
        const version = getXcodeVersion();
        console.log(`✅ Xcode ${version} installed`);
      } else {
        console.log('❌ Xcode not installed. Install from App Store.');
      }
      break;

    default:
      console.log('Xcode Commands:');
      console.log('  /xcode check              - Check Xcode installation');
      console.log('  /xcode create <name>      - Create new iOS project');
      console.log('  /xcode build [path]       - Build Xcode project');
      console.log('  /xcode simulators         - List available simulators');
  }
}
