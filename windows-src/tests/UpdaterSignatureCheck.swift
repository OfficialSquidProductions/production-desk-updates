import Foundation
import CryptoKit

@main
struct UpdaterSignatureCheck {
    static func main() throws {
        let args = CommandLine.arguments
        let key = try Curve25519.Signing.PublicKey(rawRepresentation: Data(base64Encoded: args[1])!)
        let signature = Data(base64Encoded: args[2])!
        var archive = try Data(contentsOf: URL(fileURLWithPath: args[3]))
        precondition(key.isValidSignature(signature, for: archive), "Published archive must match the embedded public key")
        archive[archive.startIndex] ^= 1
        precondition(!key.isValidSignature(signature, for: archive), "A modified download must be rejected")
        archive[archive.startIndex] ^= 1
        let otherKey = Curve25519.Signing.PrivateKey().publicKey
        precondition(!otherKey.isValidSignature(signature, for: archive), "An unrelated publisher must be rejected")
        print("Update signatures verified: embedded public key matches archive; tampered archive and unrelated signing key rejected.")
    }
}
