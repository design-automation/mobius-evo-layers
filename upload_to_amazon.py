# TO USE THIS FILE:
# _ install the following packages: boto3
# _ rename __AMAZON_KEY__.template.py to __AMAZON_KEY__.py and add your own amazon access id, key and mobius directory to the file
# _ change FUNC_NAME to be whichever function you want to update

import boto3
import os
import shutil
import zipfile
import json
import subprocess
import datetime
import re

try:
    import __AMAZON_KEY__
except ImportError:
    print('\n\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n')
    print('missing __AMAZON_KEY__.py:')
    print('  Please rename __AMAZON_KEY__.template.py to __AMAZON_KEY__.py')
    print('  and add in your amazon access id and secret key to the file. The access id and secret key')
    print('  can be found in Amazon IAM under your own username, Security Credential tab, Access Keys section')
    print('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n\n')
    
    raise ImportError()



dist_package_json_file = 'dist_package.json'

# access id and key and your mobius folder directory, getting from __AMAZON_KEY__.py file
aws_access_key_id = __AMAZON_KEY__.aws_access_key_id
aws_secret_access_key = __AMAZON_KEY__.aws_secret_access_key

# mobius_directory = 'C:\\Users\\akibdpt\\Documents\\Angular\\mobius-parametric-modeller'
# mobius_directory = 'C:\\Users\\akibdpt\\Documents\\Angular\\mobius-parametric-modeller-dev'
mobius_directory = 'C:\\Users\\akibdpt\\Documents\\Angular\\mobius-parametric-modeller-dev-0-7'

# the lambda function name
MAIN_LAYER = 'arn:aws:lambda:us-east-1:114056409474:layer:evo_layer'

# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# change this FUNC_NAME to whichever function you want to update
FUNC_NAME = MAIN_LAYER


def copy_from_mobius():
    print('\n\nCopying files from Mobius...')

    current_working_dir = os.getcwd()

    core_dir = mobius_directory + '\\src\\assets\\core'
    libs_dir = mobius_directory + '\\src\\assets\\libs'
    destination = current_working_dir + '\\src'

    try:
        shutil.rmtree(current_working_dir + '\\src\\core')
    except Exception:
        pass
    try:
        shutil.rmtree(current_working_dir + '\\src\\libs')
    except Exception:
        pass
    os.mkdir(current_working_dir + '\\src\\core')
    os.mkdir(current_working_dir + '\\src\\libs')

    copy_files(core_dir, destination)
    copy_files(libs_dir, destination)

    packageJSONFile = os.path.join(current_working_dir, dist_package_json_file)
    packageJSONDest = os.path.join(current_working_dir, 'dist\\package.json')
    if not os.path.isdir(os.path.join(current_working_dir,'dist')):
        os.mkdir(os.path.join(current_working_dir,'dist'))
    shutil.copy(packageJSONFile, packageJSONDest)
    print('Copying completed')

def copy_files(fromDir, toDir):
    os_walk_dir = os.walk(fromDir)
    for root, dirs, files in os_walk_dir:

        subDir = root.split('assets')[-1]
        for folder in dirs:
            newDir = os.path.join(toDir + subDir, folder)
            if os.path.isfile(newDir):
                os.remove(newDir)
            if not os.path.isdir(newDir):
                os.mkdir(newDir)
        for f in files:
            core_f = os.path.join(root, f)
            print('    copying:', os.path.join(subDir, f))
            if os.path.isfile(core_f):
                shutil.copy(core_f, toDir + subDir)

def build_code():
    print('\n\nBuilding code...')
    # os.system("tsc -p .")
    result = subprocess.run(["tsc", "-p", '.'], shell=True, stdout=subprocess.PIPE).stdout.decode('utf-8')
    if 'error' in result:
        print('\nERROR: Building code failed:\n')
        print(result)
        return False
    # subprocess.run(["ls", "-l"])
    print('Building code completed')
    return True

def zipdir():
    print('\n\nZipping files in nodejs folder...')
    zipPath = 'nodejs/'

    # create ziph: zipfile handle
    ziph = zipfile.ZipFile('zipped_file/zip_layer.zip', 'w', zipfile.ZIP_DEFLATED)
    count = 0
    for root, dirs, files in os.walk(zipPath):
        count += 1
        for file in files:
            fDir = os.path.join(root, file)
            # print('    Zipping', fDir)
            ziph.write(fDir, fDir)
    ziph.close()
    if count == 0:
        print('Error: No dist folder to be zipped')
        return False
    else:
        print('Zipping completed')
        return True


def upload_to_amazon(zipfile, funcName):
    print('\n\nUploading zipped file to amazon...')
    lambda_client = boto3.client('lambda', 
                    region_name='us-east-1',
                    aws_access_key_id = aws_access_key_id,
                    aws_secret_access_key = aws_secret_access_key)
    # r = lambda_client.list_layer_versions(
    #     CompatibleRuntime='nodejs14.x',
    #     LayerName=funcName,
    #     MaxItems=10
    # )
    r = lambda_client.publish_layer_version(
        LayerName=funcName,
        Description='evo layer',
        Content={
            'ZipFile': zipfile
        },
        CompatibleRuntimes=['nodejs14.x']
    )
    version = r['Version']
    print('Uploading completed')
    for i in r:
        print('   ', i ,':', r[i])
    print()

    print('Updating version permission')
    statement = 'p_' + re.sub(r'[\.\:\-\s]', '_', str(datetime.datetime.now()))
    r = lambda_client.add_layer_version_permission(
        LayerName=funcName,
        VersionNumber=version,
        StatementId= statement,
        Action='lambda:GetLayerVersion',
        Principal='*'
    )

    print('Permission update completed')
    for i in r:
        print('   ', i ,':', r[i])
    print()

    r = lambda_client.delete_layer_version(
        LayerName=funcName,
        VersionNumber=version - 4,
    )

    print('delete layer completed')
    for i in r:
        print('   ', i ,':', r[i])
    print()


def update_layer_permission(funcName, version):
    lambda_client = boto3.client('lambda', 
                    region_name='us-east-1',
                    aws_access_key_id = aws_access_key_id,
                    aws_secret_access_key = aws_secret_access_key)

    print('Updating version permission')
    statement = 'p_' + re.sub(r'[\.\:\-\s]', '_', str(datetime.datetime.now()))
    r = lambda_client.add_layer_version_permission(
        LayerName=funcName,
        VersionNumber=version,
        StatementId= statement,
        Action='lambda:GetLayerVersion',
        Principal='*'
    )

    print('Permission update completed')
    for i in r:
        print('   ', i ,':', r[i])
    print()



if __name__ == '__main__':
    # copy_from_mobius()
    buildcheck = build_code()
    if buildcheck:
        zipcheck = zipdir()
        if zipcheck:
            zippedFile = open('zipped_file/zip_layer.zip', 'rb').read()
            upload_to_amazon(zippedFile, FUNC_NAME)

    # update_layer_permission(FUNC_NAME, 16)
