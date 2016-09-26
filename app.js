const halfPrecisionFloat = require("./lib/half-precision-float");
const net = require('net');
const binary = require('binary');

class ModbusServer {
    constructor(port){
        var response;
        var responseGenerator = new ResponseGenerator();

        var processRequest = function(request){
            var functionCode = request['functionCode'];

            switch(functionCode) {
                case 3:
                    var requestedRegister = this.getHoldingRegister(request['registerAddress']);

                    console.log(request['registerAddress']);

                    if(requestedRegister !== undefined){
                        response = responseGenerator.holdingRegister(request, halfPrecisionFloat.toHalf(requestedRegister));
                    }else{
                        response = responseGenerator.exception(request, 0x02);
                    }

                    console.log(response);

                    this.stream.write(response);
                    break;
                default:
                    response = responseGenerator.exception(request, 0x01);
                    this.stream.write(response);
                    break;
            }
        }.bind(this);

        this.holdingRegisters = [];

        net.createServer((stream) => {
            console.log('CLIENT CONNECTED');

            this.stream = stream;

            this.stream
                .on('data',rawData => {
                    console.log(rawData);
                    try{
                        var request = ModbusParser.parse(rawData);
                        processRequest(request);
                    }catch(err){
                        console.log(err);
                    }
                })
                .on('end', () => {
                    console.log('CLIENT DISCONNECTED');
                });
        })
        .on('error', err => {
            console.log(err);
        })
        .listen(port, () => {
            console.log('LISTENING ON: '+port);
        });
    }

    getHoldingRegister(registerAddres){
        return this.holdingRegisters[registerAddres];
    }

    setHoldingRegister(registerAddres, value){
        this.holdingRegisters[registerAddres] = value;
    }
}

class ResponseGenerator {
    constructor(){
        this.exceptionBuffer = Buffer.alloc(9);
        this.exceptionBuffer.writeUInt16BE(0, 2);
        this.exceptionBuffer.writeUInt16BE(3, 4);
        this.exceptionBuffer.writeUInt8(0x80, 7);

        this.holdingRegisterBuffer = Buffer.alloc(11);
        this.holdingRegisterBuffer.writeUInt16BE(0, 2);
        this.holdingRegisterBuffer.writeUInt16BE(5, 4);
        this.holdingRegisterBuffer.writeUInt8(3, 7);
        this.holdingRegisterBuffer.writeUInt8(2, 8);
    }

    holdingRegister(request, registerValue){
        this.holdingRegisterBuffer.writeUInt16BE(request['id'],0);
        this.holdingRegisterBuffer.writeUInt8(request['unit'], 6);
        this.holdingRegisterBuffer.writeUInt16BE(registerValue, 9);

        return this.holdingRegisterBuffer;
    }

    exception(request, exceptionCode){
        this.exceptionBuffer.writeUInt16BE(request['id'],0);
        this.exceptionBuffer.writeUInt8(request['unit'], 6);
        this.exceptionBuffer.writeUInt8(exceptionCode, 8);

        return this.exceptionBuffer;
    }
}

class ModbusParser {
    static parse(rawData){
        return binary.parse(rawData)
            .word16bu("id")
            .word16bu("protocol")
            .word16bu("length")
            .word8bu("unit")
            .word8bu("functionCode")
            .word16bu("registerAddress")
            .word16bu("quantity")
            .vars;
    }
}

exports.ModbusServer = ModbusServer;