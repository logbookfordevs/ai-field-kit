import base64, json, pathlib

here = pathlib.Path(__file__).parent
root = here.parents[3]
src = (here / "src.html").read_text()
data = json.loads((here / "data.json").read_text())
fonts = [("IBM Plex Mono", 400, 0), ("IBM Plex Mono", 600, 1), ("Poppins", 400, 2), ("Poppins", 500, 3), ("Poppins", 600, 4)]
faces = "".join(
    "@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:swap;src:url(data:font/ttf;base64,%s) format('truetype')}\n"
    % (name, weight, base64.b64encode((root / f"packages/afk/app/public/assets/font-{index}.ttf").read_bytes()).decode())
    for name, weight, index in fonts
)
out = src.replace("/*__FONTS__*/", faces).replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
dest = here.parent / "prototype.html"
dest.write_text(out)
print(dest, len(out))
