hujan = input("apakah sedang hujan?:")

if hujan == "iya":
    deras = input("apakah hujan deras?:")
    if deras == "iya":
        print("bawa payung dan jas hujan")
    else:
        print("tidak bawa payung")
        
elif hujan == "tidak":
print ("tidak perlu membawa payung")    

else :
    print ("input tidak valid")  