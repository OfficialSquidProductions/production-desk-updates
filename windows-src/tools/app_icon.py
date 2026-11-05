"""Derive Windows app/installer icons from the approved full app artwork."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICON_SOURCE = ROOT / 'desktop/assets/ProductionDesk.png'
ICON_SIZES = (16, 24, 32, 48, 64, 128, 256)


def build_windows_icon(destination=None):
    from PIL import Image
    destination = Path(destination) if destination else ROOT / 'desktop/windows/assets/icon.ico'
    with Image.open(ICON_SOURCE) as image:
        if image.width != image.height or image.width < 1024:
            raise ValueError('Production Desk icon must be square and at least 1024 pixels.')
        # Preserve the complete approved composition and transparent outer corners.
        artwork = image.convert('RGBA')
        destination.parent.mkdir(parents=True, exist_ok=True)
        artwork.save(destination, format='ICO', sizes=[(size, size) for size in ICON_SIZES])
    with Image.open(destination) as result:
        if result.ico.sizes() != {(size, size) for size in ICON_SIZES}:
            raise ValueError('The Windows icon does not contain every required resolution.')
    return destination


if __name__ == '__main__':
    print(build_windows_icon())
