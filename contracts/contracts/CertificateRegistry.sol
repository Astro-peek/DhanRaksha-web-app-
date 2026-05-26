// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateRegistry
 * @notice Immutable on-chain registry for SafeKosh income certificate attestations.
 *         Stores SHA-256 hashes anchored to cert IDs with validity windows.
 * @dev    Only the deployer (SafeKosh backend wallet) can issue or revoke certificates.
 */
contract CertificateRegistry is Ownable {

    struct Certificate {
        bytes32 hash;
        uint256 issuedAt;
        uint256 validUntil;
        bool revoked;
    }

    // certId (keccak256 of cert_ref string) → Certificate
    mapping(bytes32 => Certificate) public certificates;

    // ── Events ───────────────────────────────────────────────────────────────
    event CertificateIssued(bytes32 indexed certId, bytes32 hash, uint256 issuedAt, uint256 validUntil);
    event CertificateRevoked(bytes32 indexed certId, uint256 revokedAt);

    // ── Write Functions ──────────────────────────────────────────────────────

    /**
     * @notice Anchor a new certificate hash on-chain.
     * @param certId     keccak256(certRef) — unique identifier
     * @param hash       SHA-256 attestation hash of certificate data
     * @param validUntil Unix timestamp when the certificate expires
     */
    function issueCertificate(bytes32 certId, bytes32 hash, uint256 validUntil) external onlyOwner {
        require(certificates[certId].issuedAt == 0, "Certificate exists");

        certificates[certId] = Certificate({
            hash: hash,
            issuedAt: block.timestamp,
            validUntil: validUntil,
            revoked: false
        });

        emit CertificateIssued(certId, hash, block.timestamp, validUntil);
    }

    /**
     * @notice Revoke a certificate (e.g., fraud detected).
     */
    function revoke(bytes32 certId) external onlyOwner {
        require(certificates[certId].issuedAt > 0, "Not found");
        certificates[certId].revoked = true;
        emit CertificateRevoked(certId, block.timestamp);
    }

    // ── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Verify a certificate hash against the on-chain record.
     * @return True if the hash matches, cert is not revoked, and has not expired.
     */
    function verify(bytes32 certId, bytes32 hash) external view returns (bool) {
        Certificate memory c = certificates[certId];
        return c.hash == hash && !c.revoked && c.validUntil >= block.timestamp;
    }

    /**
     * @notice Fetch full certificate metadata.
     */
    function getCertificate(bytes32 certId) external view returns (Certificate memory) {
        return certificates[certId];
    }
}
