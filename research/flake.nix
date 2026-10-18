{
  description = "Southampton consultation data and model research environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pkgs.python3.withPackages (ps:
            let
              laya = ps.buildPythonPackage rec {
                pname = "laya";
                version = "0.4.11";
                pyproject = true;
                src = pkgs.fetchPypi {
                  inherit pname version;
                  hash = "sha256-4cIb5i3Omj8RAuBT1IyFlRIVo2vbma34+nknGhUv6FU=";
                };
                build-system = [ ps.setuptools ];
                dependencies = [ ps.torch ps.transformers ps.safetensors ps.huggingface-hub ps.numpy ];
                doCheck = false;
                pythonImportsCheck = [ "laya" ];
              };
            in [
            laya
            ps.pandas
            ps.pyarrow
            ps.pymupdf
            ps.pdfplumber
            ps.pandera
            ps.pytest
            ps.black
            ps.pylint
            ps.jinja2
            ps.pyyaml
            ps.matplotlib
            ps.scikit-learn
            ps.lightgbm
            ps.joblib
            ps.litellm
            ps.dspy
            ps.optuna
            ps.transformers
            ps.torch
            ps.sentencepiece
            ps.protobuf
            ps.huggingface-hub
          ]);
        in {
          default = pkgs.mkShell {
            packages = [ pkgs.bash pkgs.curl pkgs.pyright python ];
            CONSULTATION_NIX_ENV = "1";
            PYTHONNOUSERSITE = "1";
            LITELLM_LOCAL_MODEL_COST_MAP = "True";
            shellHook = ''
              export HF_HOME="$PWD/.cache/huggingface-home"
              export DSPY_CACHEDIR="$PWD/.cache/dspy"
              export MPLCONFIGDIR="$PWD/.cache/matplotlib"
            '';
          };
        });
    };
}
