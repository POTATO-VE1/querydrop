#!/usr/bin/env python3
"""
Generate synthetic sample data files for the QueryDrop Sample Library.
All data is fully synthetic — no copyright concerns. Sizes are kept small
(< 50KB per file) so the library adds < 200KB to the static bundle.
"""
import json
import os
import random
from datetime import datetime, timedelta

random.seed(42)

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'samples')
os.makedirs(OUT, exist_ok=True)


def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    size = os.path.getsize(path)
    print(f'  {name}: {size:,} bytes')
    return size


# 1. iris.csv — 150 rows, 4 features + species (setosa/versicolor/virginica)
def gen_iris():
    lines = ['sepal_length,sepal_width,petal_length,petal_width,species']
    species_params = {
        'setosa': (5.0, 3.4, 1.5, 0.3),
        'versicolor': (5.9, 2.8, 4.3, 1.3),
        'virginica': (6.6, 3.0, 5.5, 2.0),
    }
    for species, (sl_m, sw_m, pl_m, pw_m) in species_params.items():
        for _ in range(50):
            sl = round(random.gauss(sl_m, 0.35), 1)
            sw = round(random.gauss(sw_m, 0.38), 1)
            pl = round(random.gauss(pl_m, 0.45), 1)
            pw = round(random.gauss(pw_m, 0.20), 1)
            lines.append(f'{sl},{sw},{pl},{pw},{species}')
    return '\n'.join(lines) + '\n'


# 2. cities.csv — 60 world cities with name, country, population, lat, lon
def gen_cities():
    cities = [
        ('Tokyo', 'Japan', 13960000, 35.68, 139.69),
        ('Delhi', 'India', 32940000, 28.61, 77.21),
        ('Shanghai', 'China', 28517000, 31.23, 121.47),
        ('São Paulo', 'Brazil', 22429000, -23.55, -46.63),
        ('Mexico City', 'Mexico', 22418000, 19.43, -99.13),
        ('Cairo', 'Egypt', 21750000, 30.04, 31.24),
        ('Mumbai', 'India', 20961000, 19.08, 72.88),
        ('Beijing', 'China', 20489000, 39.90, 116.41),
        ('Dhaka', 'Bangladesh', 22310000, 23.81, 90.41),
        ('Osaka', 'Japan', 19070000, 34.69, 135.50),
        ('New York', 'United States', 18713000, 40.71, -74.01),
        ('Karachi', 'Pakistan', 17400000, 24.86, 67.01),
        ('Buenos Aires', 'Argentina', 15370000, -34.61, -58.38),
        ('Chongqing', 'China', 16410000, 29.43, 106.91),
        ('Istanbul', 'Turkey', 15840000, 41.01, 28.98),
        ('Kolkata', 'India', 14979000, 22.57, 88.36),
        ('Manila', 'Philippines', 13923000, 14.60, 120.98),
        ('Lagos', 'Nigeria', 15388000, 6.52, 3.38),
        ('Rio de Janeiro', 'Brazil', 13634000, -22.91, -43.17),
        ('Tianjin', 'China', 14060000, 39.34, 117.36),
        ('Kinshasa', 'DR Congo', 15674000, -4.44, 15.27),
        ('Guangzhou', 'China', 13916000, 23.13, 113.26),
        ('Los Angeles', 'United States', 12705000, 34.05, -118.24),
        ('Moscow', 'Russia', 12506000, 55.76, 37.62),
        ('Shenzhen', 'China', 12530000, 22.54, 114.06),
        ('Lahore', 'Pakistan', 13095000, 31.55, 74.34),
        ('Bangalore', 'India', 13193000, 12.97, 77.59),
        ('Paris', 'France', 11020000, 48.86, 2.35),
        ('Bogotá', 'Colombia', 11167000, 4.71, -74.07),
        ('Jakarta', 'Indonesia', 11584000, -6.21, 106.85),
        ('Chennai', 'India', 11503000, 13.08, 80.27),
        ('Lima', 'Peru', 11204000, -12.05, -77.04),
        ('Bangkok', 'Thailand', 10722000, 13.76, 100.50),
        ('Seoul', 'South Korea', 9960000, 37.57, 126.98),
        ('London', 'United Kingdom', 9540000, 51.51, -0.13),
        ('Tehran', 'Iran', 9259000, 35.69, 51.39),
        ('Hong Kong', 'China', 7482000, 22.32, 114.17),
        ('Sydney', 'Australia', 5312000, -33.87, 151.21),
        ('Berlin', 'Germany', 3645000, 52.52, 13.41),
        ('Toronto', 'Canada', 6313000, 43.65, -79.38),
        ('Madrid', 'Spain', 6713000, 40.42, -3.70),
        ('Rome', 'Italy', 4316000, 41.90, 12.50),
        ('Vienna', 'Austria', 1930000, 48.21, 16.37),
        ('Amsterdam', 'Netherlands', 1166000, 52.37, 4.90),
        ('Stockholm', 'Sweden', 1632000, 59.33, 18.07),
        ('Dubai', 'UAE', 3504000, 25.20, 55.27),
        ('Singapore', 'Singapore', 5917000, 1.35, 103.82),
        ('Zurich', 'Switzerland', 421000, 47.38, 8.54),
        ('Cape Town', 'South Africa', 4710000, -33.92, 18.42),
        ('Santiago', 'Chile', 5600000, -33.45, -70.66),
        ('Athens', 'Greece', 3154000, 37.98, 23.73),
        ('Lisbon', 'Portugal', 2956000, 38.72, -9.14),
        ('Prague', 'Czech Republic', 1335000, 50.08, 14.44),
        ('Budapest', 'Hungary', 1751000, 47.50, 19.04),
        ('Warsaw', 'Poland', 1794000, 52.23, 21.01),
        ('Helsinki', 'Finland', 658000, 60.17, 24.94),
        ('Oslo', 'Norway', 697000, 59.91, 10.75),
        ('Copenhagen', 'Denmark', 1346000, 55.68, 12.57),
        ('Reykjavik', 'Iceland', 131000, 64.13, -21.82),
    ]
    lines = ['city,country,population,latitude,longitude']
    for name, country, pop, lat, lon in cities:
        lat_s = f'{lat:.2f}'
        lon_s = f'{lon:.2f}'
        # Quote city names with commas or spaces
        if ',' in name or ' ' in name:
            name = f'"{name}"'
        lines.append(f'{name},{country},{pop},{lat_s},{lon_s}')
    return '\n'.join(lines) + '\n'


# 3. titanic.csv — 220 synthetic passenger records
def gen_titanic():
    first_names = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
                   'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
                   'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
                   'Matthew', 'Margaret', 'Anthony', 'Betty', 'Mark', 'Sandra', 'Donald', 'Ashley',
                   'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
                   'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
                  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
                  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
                  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores']
    titles = ['Mr.', 'Mrs.', 'Miss', 'Master', 'Dr.']
    ports = ['Southampton', 'Cherbourg', 'Queenstown']
    pclass_dist = [1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
    lines = ['passenger_id,survived,pclass,name,sex,age,sibsp,parch,ticket,fare,cabin,embarked']
    for i in range(1, 221):
        survived = random.choice([0, 0, 0, 0, 1, 1, 1])
        pclass = random.choice(pclass_dist)
        title = random.choice(titles)
        first = random.choice(first_names)
        last = random.choice(last_names)
        name = f'{title} {first} {last}'
        sex = 'female' if title in ('Mrs.', 'Miss') else 'male'
        if random.random() < 0.05:
            sex = 'female' if sex == 'male' else 'male'
        if pclass == 1:
            age = round(max(0, random.gauss(38, 12)), 1)
        elif pclass == 2:
            age = round(max(0, random.gauss(29, 14)), 1)
        else:
            age = round(max(0, random.gauss(25, 16)), 1)
        if age < 1:
            age = round(age, 1)
        sibsp = random.choices([0, 0, 0, 0, 1, 1, 2, 3], k=1)[0]
        parch = random.choices([0, 0, 0, 0, 1, 1, 2], k=1)[0]
        ticket = f'{random.choice(["A", "B", "C", "PC", "STON", "S", "CA"])}{random.randint(10000, 99999)}'
        if pclass == 1:
            fare = round(random.gauss(80, 30), 2)
        elif pclass == 2:
            fare = round(random.gauss(20, 8), 2)
        else:
            fare = round(max(0, random.gauss(8, 4)), 2)
        cabin = ''
        if pclass == 1 and random.random() < 0.6:
            deck = random.choice(['A', 'B', 'C', 'D', 'E'])
            num = random.randint(1, 50)
            cabin = f'{deck}{num}'
        elif pclass == 2 and random.random() < 0.3:
            deck = random.choice(['D', 'E', 'F'])
            num = random.randint(1, 50)
            cabin = f'{deck}{num}'
        elif pclass == 3 and random.random() < 0.1:
            deck = random.choice(['F', 'G'])
            num = random.randint(1, 50)
            cabin = f'{deck}{num}'
        embarked = random.choice(ports)
        lines.append(f'{i},{survived},{pclass},"{name}",{sex},{age},{sibsp},{parch},{ticket},{fare},{cabin},{embarked}')
    return '\n'.join(lines) + '\n'


# 4. sales-q1.csv — 500 rows of Q1 sales (Jan-Mar 2024)
def gen_sales():
    products = [
        ('Widget A', 12.50, 'Hardware'),
        ('Widget B', 24.99, 'Hardware'),
        ('Widget C', 49.00, 'Hardware'),
        ('Gadget X', 89.00, 'Electronics'),
        ('Gadget Y', 149.50, 'Electronics'),
        ('Cable Pack', 8.99, 'Accessories'),
        ('Charger Pro', 29.99, 'Accessories'),
        ('Stand Deluxe', 39.00, 'Accessories'),
        ('Bag Pro', 59.00, 'Bags'),
        ('Pouch Mini', 14.50, 'Bags'),
    ]
    regions = ['North', 'South', 'East', 'West', 'Central']
    channels = ['Online', 'Retail', 'Wholesale']
    reps = ['Alex Chen', 'Jordan Smith', 'Sam Patel', 'Riley Garcia', 'Casey Kim', 'Morgan Lee', 'Taylor Brown', 'Drew Wilson']
    lines = ['order_id,order_date,region,channel,product,category,unit_price,quantity,revenue,rep']
    start = datetime(2024, 1, 1)
    for i in range(1, 501):
        d = start + timedelta(days=random.randint(0, 90), hours=random.randint(0, 23))
        date_s = d.strftime('%Y-%m-%d')
        product, price, category = random.choice(products)
        qty = random.choices([1, 1, 1, 2, 2, 3, 4, 5, 10], k=1)[0]
        revenue = round(price * qty * random.uniform(0.95, 1.05), 2)
        lines.append(f'Q1-{i:04d},{date_s},{random.choice(regions)},{random.choice(channels)},"{product}",{category},{price},{qty},{revenue},{random.choice(reps)}')
    return '\n'.join(lines) + '\n'


# 5. server-logs.ndjson — 200 synthetic log entries
def gen_logs():
    paths = ['/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/auth/logout',
             '/api/cart', '/api/checkout', '/api/search', '/healthz', '/static/app.js']
    methods = ['GET', 'GET', 'GET', 'GET', 'POST', 'POST', 'PUT', 'DELETE']
    levels = ['INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR']
    user_agents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'curl/8.4.0',
        'PostmanRuntime/7.36.0',
    ]
    lines = []
    base = datetime(2024, 3, 1, 8, 0, 0)
    for i in range(200):
        ts = base + timedelta(seconds=random.randint(0, 86400 * 7))
        method = random.choice(methods)
        path = random.choice(paths)
        if method != 'GET':
            status = random.choices([200, 201, 400, 401, 404, 500], weights=[5, 3, 2, 1, 2, 1], k=1)[0]
        else:
            status = random.choices([200, 200, 200, 200, 304, 404, 500], weights=[10, 10, 10, 10, 2, 1, 1], k=1)[0]
        if status >= 500:
            level = 'ERROR'
        elif status >= 400:
            level = 'WARN'
        else:
            level = random.choice(['INFO', 'INFO', 'INFO', 'DEBUG'])
        duration = random.randint(1, 500) if status < 500 else random.randint(500, 5000)
        lines.append(json.dumps({
            'timestamp': ts.isoformat() + 'Z',
            'level': level,
            'method': method,
            'path': path,
            'status': status,
            'duration_ms': duration,
            'user_agent': random.choice(user_agents),
            'request_id': f'req_{i:06d}',
        }))
    return '\n'.join(lines) + '\n'


# 6. books.json — 30 public-domain books (Project Gutenberg — public domain in US)
def gen_books():
    books = [
        {'id': 1342, 'title': 'Pride and Prejudice', 'author': 'Austen, Jane', 'year': 1813, 'language': 'en', 'subject': 'Fiction', 'downloads': 50000},
        {'id': 11, 'title': "Alice's Adventures in Wonderland", 'author': 'Carroll, Lewis', 'year': 1865, 'language': 'en', 'subject': 'Fiction', 'downloads': 42000},
        {'id': 84, 'title': 'Frankenstein', 'author': 'Shelley, Mary', 'year': 1818, 'language': 'en', 'subject': 'Fiction', 'downloads': 38000},
        {'id': 1661, 'title': 'The Adventures of Sherlock Holmes', 'author': 'Doyle, Arthur Conan', 'year': 1892, 'language': 'en', 'subject': 'Mystery', 'downloads': 35000},
        {'id': 2701, 'title': 'Moby Dick', 'author': 'Melville, Herman', 'year': 1851, 'language': 'en', 'subject': 'Fiction', 'downloads': 31000},
        {'id': 100, 'title': 'The Complete Works of William Shakespeare', 'author': 'Shakespeare, William', 'year': 1623, 'language': 'en', 'subject': 'Drama', 'downloads': 28000},
        {'id': 74, 'title': 'The Adventures of Tom Sawyer', 'author': 'Twain, Mark', 'year': 1876, 'language': 'en', 'subject': 'Fiction', 'downloads': 27000},
        {'id': 345, 'title': 'Dracula', 'author': 'Stoker, Bram', 'year': 1897, 'language': 'en', 'subject': 'Horror', 'downloads': 25000},
        {'id': 1080, 'title': 'A Modest Proposal', 'author': 'Swift, Jonathan', 'year': 1729, 'language': 'en', 'subject': 'Satire', 'downloads': 22000},
        {'id': 1952, 'title': 'The Yellow Wallpaper', 'author': 'Gilman, Charlotte Perkins', 'year': 1892, 'language': 'en', 'subject': 'Fiction', 'downloads': 18000},
        {'id': 219, 'title': 'Heart of Darkness', 'author': 'Conrad, Joseph', 'year': 1899, 'language': 'en', 'subject': 'Fiction', 'downloads': 17000},
        {'id': 5200, 'title': 'Metamorphosis', 'author': 'Kafka, Franz', 'year': 1915, 'language': 'en', 'subject': 'Fiction', 'downloads': 16500},
        {'id': 174, 'title': 'The Picture of Dorian Gray', 'author': 'Wilde, Oscar', 'year': 1890, 'language': 'en', 'subject': 'Fiction', 'downloads': 16000},
        {'id': 43, 'title': 'The Strange Case of Dr. Jekyll and Mr. Hyde', 'author': 'Stevenson, Robert Louis', 'year': 1886, 'language': 'en', 'subject': 'Fiction', 'downloads': 15500},
        {'id': 1260, 'title': 'Jane Eyre', 'author': 'Brontë, Charlotte', 'year': 1847, 'language': 'en', 'subject': 'Fiction', 'downloads': 14500},
        {'id': 768, 'title': 'Wuthering Heights', 'author': 'Brontë, Emily', 'year': 1847, 'language': 'en', 'subject': 'Fiction', 'downloads': 14000},
        {'id': 1400, 'title': 'Great Expectations', 'author': 'Dickens, Charles', 'year': 1861, 'language': 'en', 'subject': 'Fiction', 'downloads': 13000},
        {'id': 98, 'title': 'A Tale of Two Cities', 'author': 'Dickens, Charles', 'year': 1859, 'language': 'en', 'subject': 'Fiction', 'downloads': 12500},
        {'id': 730, 'title': 'Oliver Twist', 'author': 'Dickens, Charles', 'year': 1838, 'language': 'en', 'subject': 'Fiction', 'downloads': 11000},
        {'id': 158, 'title': 'Emma', 'author': 'Austen, Jane', 'year': 1815, 'language': 'en', 'subject': 'Fiction', 'downloads': 10500},
        {'id': 161, 'title': 'Sense and Sensibility', 'author': 'Austen, Jane', 'year': 1811, 'language': 'en', 'subject': 'Fiction', 'downloads': 9500},
        {'id': 105, 'title': 'Persuasion', 'author': 'Austen, Jane', 'year': 1817, 'language': 'en', 'subject': 'Fiction', 'downloads': 8000},
        {'id': 121, 'title': 'Northanger Abbey', 'author': 'Austen, Jane', 'year': 1817, 'language': 'en', 'subject': 'Fiction', 'downloads': 6500},
        {'id': 141, 'title': 'The Scarlet Letter', 'author': 'Hawthorne, Nathaniel', 'year': 1850, 'language': 'en', 'subject': 'Fiction', 'downloads': 7000},
        {'id': 25344, 'title': 'The Scarlet Pimpernel', 'author': 'Orczy, Baroness', 'year': 1905, 'language': 'en', 'subject': 'Adventure', 'downloads': 5500},
        {'id': 209, 'title': 'The Turn of the Screw', 'author': 'James, Henry', 'year': 1898, 'language': 'en', 'subject': 'Horror', 'downloads': 5000},
        {'id': 76, 'title': 'Adventures of Huckleberry Finn', 'author': 'Twain, Mark', 'year': 1884, 'language': 'en', 'subject': 'Fiction', 'downloads': 11500},
        {'id': 102, 'title': 'The Souls of Black Folk', 'author': 'Du Bois, W.E.B.', 'year': 1903, 'language': 'en', 'subject': 'Essay', 'downloads': 4500},
        {'id': 78, 'title': 'Treasure Island', 'author': 'Stevenson, Robert Louis', 'year': 1883, 'language': 'en', 'subject': 'Adventure', 'downloads': 9000},
        {'id': 394, 'title': 'Cranford', 'author': 'Gaskell, Elizabeth', 'year': 1853, 'language': 'en', 'subject': 'Fiction', 'downloads': 3500},
    ]
    return json.dumps(books, indent=2) + '\n'


print('Generating sample data files:')
sizes = {
    'iris.csv': write('iris.csv', gen_iris()),
    'cities.csv': write('cities.csv', gen_cities()),
    'titanic.csv': write('titanic.csv', gen_titanic()),
    'sales-q1.csv': write('sales-q1.csv', gen_sales()),
    'server-logs.ndjson': write('server-logs.ndjson', gen_logs()),
    'books.json': write('books.json', gen_books()),
}
total = sum(sizes.values())
print(f'\nTotal: {total:,} bytes ({total / 1024:.1f} KB) across {len(sizes)} files')
