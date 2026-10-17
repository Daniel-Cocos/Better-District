{
  description = "Southampton consultation PDF aggregation environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pkgs.python3.withPackages (ps: [
            ps.pandas
            ps.pyarrow
            ps.pymupdf
            ps.pdfplumber
          ]);
        in {
          default = pkgs.mkShell {
            packages = [ pkgs.bash pkgs.curl python ];
            CONSULTATION_NIX_ENV = "1";
            PYTHONNOUSERSITE = "1";
          };
        });
    };
}
