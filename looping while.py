user ="tyon"
password = "gantenk"

while True:
    print("selamat datang di praktikum DDP")
    print("silahkan masukkan username dan password anda:")
    
    auser = input("masukkan username:")
    apassword = input("masukkan password anda:")
    
    if auser ==  user and apassword == password:
        print("selamart datang", user)
        break
    elif auser != user and apassword == password:
        print("username anda salah")
    elif auser == user and apassword !=password:
        print("password anda salah")
    else:
        print("username dan password anda tidak di kenali")