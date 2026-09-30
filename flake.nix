{
  description = "A Discord RPC for Deezer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, bun2nix, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
      ];
    in
    {
      packages = forAllSystems (system: rec {
        deezer-discord-rpc = nixpkgs.legacyPackages.${system}.callPackage ./nix/package.nix {
          bun2nix = bun2nix.packages.${system}.default;
        };
        default = deezer-discord-rpc;
      });
    };
}
