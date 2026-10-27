{
  lib,
  stdenvNoCC,
  bun2nix,
  electron_44,
  makeWrapper,
  makeDesktopItem,
  copyDesktopItems,
}:

let
  packageJson = lib.importJSON ../package.json;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../bun.lock
      ../bun.nix
      ../tsconfig.json
      ../src
    ];
  };
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = packageJson.name;
  inherit (packageJson) version;
  inherit src;

  nativeBuildInputs = [
    bun2nix.hook
    makeWrapper
    copyDesktopItems
  ];

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ../bun.nix;
  };

  # The hook defaults to the isolated linker, where transitive dependencies
  # the code imports directly, like discord-api-types, are not resolvable.
  bunInstallFlags = [ "--linker=hoisted" ];

  buildPhase = ''
    runHook preBuild

    bun run tsc
    bun run copy-assets

    # The shipped tree mirrors the repo so package.json's main resolves as is.
    # A production install keeps the build toolchain out of it.
    mkdir app
    cp package.json bun.lock app/
    bun install --cwd app --frozen-lockfile --ignore-scripts --production
    cp -R build app/

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/share"
    cp -R app "$out/share/${finalAttrs.pname}"

    # Nix handles updates, so the app's own update check is turned off.
    makeWrapper ${lib.getExe electron_44} "$out/bin/${finalAttrs.pname}" \
      --add-flags "$out/share/${finalAttrs.pname}" \
      --add-flags --disable-updates

    for icon in src/img/icons/*.png; do
      install -Dm644 "$icon" "$out/share/icons/hicolor/$(basename "$icon" .png)/apps/${finalAttrs.pname}.png"
    done

    runHook postInstall
  '';

  desktopItems = [
    (makeDesktopItem {
      name = finalAttrs.pname;
      desktopName = "Deezer Discord RPC";
      comment = packageJson.description;
      exec = finalAttrs.pname;
      icon = finalAttrs.pname;
      categories = [
        "Audio"
        "AudioVideo"
      ];
    })
  ];

  meta = {
    description = packageJson.description;
    homepage = "https://github.com/CuteTenshii/deezer-discord-rpc";
    license = lib.licenses.mit;
    mainProgram = finalAttrs.pname;
    platforms = lib.platforms.linux;
  };
})
