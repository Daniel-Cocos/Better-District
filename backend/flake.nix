{
  description = "Python FastAPI development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            (python3.withPackages (ps: with ps; [
              pylint
              black
              pytest
              hypothesis
              requests
              fastapi
              uvicorn
              httpx
            ]))
            pyright
            sqlite
          ];

          shellHook = ''
            echo "Python dev env activated!"
            echo "Run: make dev"
          '';
        };
      });
}
