# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: 2026 D3SOX
"""Run with: QT_QPA_PLATFORM=offscreen python -m unittest discover -s tests.

Requires PySide6. Exercise Qt's SVG renderer, as used by KDE applications.
"""

from pathlib import Path
import os
import unittest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtGui import QImage, QPainter
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import QApplication


ICONS = Path(__file__).resolve().parents[1] / "icons/oxygen-accent/base"
APP = QApplication.instance() or QApplication([])


def render(source, size):
    renderer = QSvgRenderer(source.encode())
    assert renderer.isValid()
    image = QImage(size, size, QImage.Format.Format_ARGB32)
    image.fill(0)
    painter = QPainter(image)
    renderer.render(painter)
    painter.end()
    return image


class FolderRenderingTest(unittest.TestCase):
    def test_folder_outline_is_not_clipped(self):
        for source_size in (128, 256):
            path = ICONS / f"{source_size}x{source_size}/mimetypes/inode-directory.svg"
            source = path.read_text()
            for color in ("#3daee9", "#6a8750", "#b060c0"):
                for size in (96, 128, 192, 256):
                    with self.subTest(source=source_size, color=color, size=size):
                        image = render(source.replace("#3daee9", color), size)
                        # Points inside the vector's tab and rounded bottom
                        # edge, incorrectly cut out by the raster bounds mask.
                        for x, y in ((15, 12), (4, 108), (123, 108)):
                            pixel = image.pixelColor(round(x * size / 128),
                                                     round(y * size / 128))
                            with self.subTest(point=(x, y)):
                                self.assertGreater(pixel.alpha(), 200)


if __name__ == "__main__":
    unittest.main()
