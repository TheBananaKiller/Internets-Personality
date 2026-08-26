import pyodbc
import re
from typing import Any
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

conn_str = (
    r"DRIVER={ODBC Driver 17 for SQL Server};"
    r"SERVER=192.168.1.12;"
    r"DATABASE=InternetsPersonality;"
    r"UID=InternetsPersonality;"
    r"PWD=Pixels_are_cool57;"
    r"Encrypt=yes;"
    r"TrustServerCertificate=yes;"
)

last_change = 0

DEV_MODE = True
dev_pixels = {}

def get_active_pixels(conn_str: str) -> list[dict[str, Any]]:
    """
    Calls dbo.GetActivePixels and returns all active pixels.
    """

    sql = "EXEC dbo.GetActivePixels;"

    with pyodbc.connect(conn_str, timeout=5) as connection:
        cursor = connection.cursor()
        cursor.execute(sql)

        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

        return [
            dict(zip(columns, row))
            for row in rows
        ]


def update_pixel_db(
    conn_str: str,
    x: int,
    y: int,
    red: int,
    green: int,
    blue: int,
    alpha: int,
    user_id: str,
    source_address: str,
) -> dict[str, Any]:
    """
    Calls dbo.UpdatePixel and returns the newly inserted pixel record.
    """

    sql = """
        EXEC dbo.UpdatePixel
            @X = ?,
            @Y = ?,
            @Red = ?,
            @Green = ?,
            @Blue = ?,
            @Alpha = ?,
            @UserID = ?,
            @SourceAddress = ?;
    """

    parameters = (
        x,
        y,
        red,
        green,
        blue,
        alpha,
        user_id,
        source_address,
    )

    with pyodbc.connect(conn_str, timeout=5) as connection:
        cursor = connection.cursor()
        cursor.execute(sql, parameters)

        row = cursor.fetchone()

        if row is None:
            raise RuntimeError(
                "UpdatePixel did not return a pixel record."
            )

        columns = [column[0] for column in cursor.description]
        pixel = dict(zip(columns, row))

        connection.commit()

        return pixel


@app.route("/pixels", methods=["GET"])
def get_pixels():

    if DEV_MODE:
        return jsonify(dev_pixels)

    db_pixels = get_active_pixels(conn_str)

    result = {}

    for pixel in db_pixels:
        x = pixel["X"]
        y = pixel["Y"]

        color = (
            f'rgb({pixel["Red"]}, '
            f'{pixel["Green"]}, '
            f'{pixel["Blue"]})'
        )

        result[f"{x},{y}"] = color

    return jsonify(result)


@app.route("/pixel", methods=["POST"])
def update_pixel():

    global last_change

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "status": "error",
                "error": "No JSON data received"
            }), 400

        x = int(data["x"])
        y = int(data["y"])
        color = data["color"]

        # Extract RGB values from:
        # rgb(255, 128, 0)

        match = re.match(
            r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)",
            color
        )

        


        if not match:
            return jsonify({
                "status": "error",
                "error": f"Invalid color: {color}"
            }), 400

        red = int(match.group(1))
        green = int(match.group(2))
        blue = int(match.group(3))

        # Database values
        alpha = 255

        # Temporary user ID
        user_id = "anonymous"

        # Get user's IP address
        source_address = request.remote_addr or "unknown"

        print("========== PIXEL UPDATE ==========")
        print("X:", x)
        print("Y:", y)
        print("Color:", color)
        print("RGB:", red, green, blue)
        print("IP:", source_address)

        if DEV_MODE:
            dev_pixels[f"{x},{y}"] = color
            last_change += 1

            print("DEV MODE - Pixel saved locally")
            print("===================================")

            return jsonify({
                "status": "success",
                "pixel": {
                "X": x,
                "Y": y,
                "Red": red,
                "Green": green,
                "Blue": blue,
                "Alpha": 255
            }
        })
    ###
        # Write to SQL Server
        pixel = update_pixel_db(
            conn_str,
            x,
            y,
            red,
            green,
            blue,
            alpha,
            user_id,
            source_address,
        )
        ###
        last_change += 1

        print("DATABASE UPDATE SUCCESS")
        print("===================================")

        return jsonify({
            "status": "success",
            "pixel": pixel
        })

    except Exception as e:

        print("========== PIXEL ERROR ==========")
        print(repr(e))
        print("=================================")

        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@app.route("/updates", methods=["GET"])
def updates():

    if DEV_MODE:
        return jsonify({
            "pixels": dev_pixels,
            "version": last_change
        })

    try:
        db_pixels = get_active_pixels(conn_str)

        result = {}

        for pixel in db_pixels:
            x = pixel["X"]
            y = pixel["Y"]

            color = (
                f'rgb({pixel["Red"]}, '
                f'{pixel["Green"]}, '
                f'{pixel["Blue"]})'
            )

            result[f"{x},{y}"] = color

        return jsonify({
            "pixels": result,
            "version": last_change
        })

    except Exception as e:
        import traceback
        traceback.print_exc()

        return jsonify({
            "pixels": {},
            "version": last_change
        })


@app.route("/")
def home():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)